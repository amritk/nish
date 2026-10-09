// The UDP half of the loopback suite: one `pollWait` loop that holds a Nish
// server on one UDP socket — QUIC alone, `nish/net/http3-server` serving
// HTTP/3, or the same carrier with a `WebTransport` over every slot — and a
// Nish client on another. The kernel carries every datagram: the client
// sends from its socket, the loop wakes the server's, and what the server
// sends is read off the client's socket when the loop wakes it.
//
// The client is `net_quic_conn`'s `QcClient`, whose handshake and packet
// protection are pinned against RFC 8448 and RFC 9001. What it may send it
// learns from the wire: the server's transport parameters out of its
// EncryptedExtensions, then every MAX_DATA, MAX_STREAM_DATA and MAX_STREAMS
// the server sends, so a server that forgot to give credit back stalls it.
// What the server sends on its streams is read by the HTTP/3 and WebTransport
// lanes' own peers (`H3Peer.absorb`, `WtPeer.absorb`). Those peers also hold
// a server, for their lanes' in-memory runs; here only their client half is
// called, and the server they are handed is never driven through them.
//
// The server side is a program as the relay would write one: read the
// socket when it is readable, run the timers, answer every slot with news,
// flush, and sleep until the next timer. Every wait is bounded: five seconds
// without progress is a failure, never a hang.
import { netAddress, netClose, netLocalPort, pollAdd, pollCreate, pollWait, udpBind, udpRecvFrom, udpSendTo } from "nish:net";
import { Secret, wipe } from "nish:secret";
import {
  QUIC_FRAME_CONNECTION_CLOSE,
  QUIC_FRAME_CONNECTION_CLOSE_APP,
  QUIC_FRAME_DATAGRAM,
  QUIC_FRAME_MAX_DATA,
  QUIC_FRAME_MAX_STREAMS_BIDI,
  QUIC_FRAME_MAX_STREAMS_UNI,
  QUIC_FRAME_MAX_STREAM_DATA,
  QuicFrame,
  quicDatagramSize,
  quicParseFrame,
  quicPushAck,
  quicPushConnectionClose,
  quicPushStream,
  quicPutDatagram,
} from "nish/net/quic-frame";
import { QuicTransportParameters, quicParseTransportParameters } from "nish/net/quic-conn-params";
import { QUIC_CONN_CID_LENGTH, QUIC_CONN_DATAGRAM_SIZE, QUIC_STATE_DRAINING, QuicConnection, QuicServerConfig } from "nish/net/quic";
import {
  QUIC_LISTEN_ACCEPT,
  QUIC_LISTENER_ENTROPY_SIZE,
  QUIC_LISTENER_FLIGHT_MAX,
  QuicFlight,
  QuicListener,
  QuicListenerAnswer,
  quicListenerPaceTime,
  quicListenerTakeFlight,
} from "nish/net/quic-listener";
import { QUIC_MAX_CID_LENGTH } from "nish/net/quic-packet";
import { tlsSignEcdsaP256 } from "nish/net/tls";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { H3_ERROR, H3_NEED_MORE, Http3Config, Http3Connection } from "nish/net/http3";
import { Http3Server } from "nish/net/http3-server";
import { WebTransport, WebTransportConfig } from "nish/net/webtransport";
import { fromHex } from "../crypto_x509/hex";
import { range } from "../net_tls_record_common/bytes";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafPrivate } from "../net_tls_common/server";
import { splitMessages } from "../net_tls_common/client";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { CLIENT_SCID, QcClient, qcCrypto, qcFinishedPacket, qcInitial, qcReadFlight, qcReceive, qcShort } from "../net_quic_conn/client";
import { LbMeter, lbBegin, lbEnd, lbLeafKey } from "./common";
import { H3App, QuicApp, WtApp } from "./udp-apps";

/** Which carrier the loop's server runs. */
export const CARRIER_QUIC: i32 = 0;
export const CARRIER_H3: i32 = 1;
export const CARRIER_WT: i32 = 2;

/** The tokens of the two sockets. */
const SERVER: i32 = 1;
const CLIENT: i32 = 2;

/** The most stream bytes the client puts in one packet. */
const CHUNK: i32 = 1000;

/** Milliseconds on the monotonic clock, the time every server call is handed. */
export const lbNowMs = (): i64 => monotonicNanos() / n64(1000000);

/** The listener's entropy: 0x30, 0x31, … */
const lbListenerEntropy = (): u8[] => {
  const out: u8[] = new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE);
  for (let k: i32 = 0; k < QUIC_LISTENER_ENTROPY_SIZE; k++) {
    out[k] = toU8(0x30 + k);
  }
  return out;
};

/**
 * The QUIC carrier, as a program on QUIC alone writes it — `nish/net` has
 * HTTP/3's pool but none for bare QUIC: a `QuicListener` in front of one
 * `QuicConnection` slot, `reset` for each client, its flights paced and sent
 * with GSO by `quicListenerTakeFlight`, and `QuicApp` answering its streams
 * and datagrams.
 */
export class QuicEchoServer {
  listener: QuicListener;
  conn: QuicConnection;
  app: QuicApp;
  rx: u8[];
  tx: u8[];
  from: u8[];
  address: u8[];
  meta: i32[];
  entropy: u8[];
  leaf: u8[];
  flight: QuicFlight;
  fd: i32 = -1;
  busy: boolean = false;
  accepted: i32 = 0;
  /** How the last connection ended: its error code, whether it was the application's, whether the client closed it. */
  lastError: i64 = -1;
  lastErrorApp: boolean = false;
  lastClosedByPeer: boolean = false;

  constructor(config: QuicServerConfig, fd: i32) {
    this.fd = fd;
    this.listener = new QuicListener(config, lbListenerEntropy());
    this.entropy = fixedEntropy();
    this.conn = new QuicConnection(config, this.entropy);
    this.app = new QuicApp(n32(8));
    this.rx = new Array<u8>(65536);
    this.tx = new Array<u8>(QUIC_LISTENER_FLIGHT_MAX * QUIC_CONN_DATAGRAM_SIZE);
    this.from = new Array<u8>(18);
    this.address = new Array<u8>(18);
    this.meta = [n32(0), n32(0)];
    this.leaf = leafPrivate();
    this.flight = new QuicFlight();
  }

  /** Reads every datagram waiting, cut into its GRO segments, each to the slot or the listener. */
  receive(now: i64): void {
    for (let burst: i32 = 0; burst < 256; burst++) {
      const n: i32 = udpRecvFrom(this.fd, this.rx, n32(0), toI32(this.rx.length), this.from, this.meta);
      if (n < 0) {
        return;
      }
      const segment: i32 = this.meta[0] > 0 ? this.meta[0] : n;
      for (let at: i32 = 0; at < n && segment > 0; at += segment) {
        this.datagram(at, n - at < segment ? n - at : segment, now);
      }
    }
  }

  /** One datagram, `rx[at .. at + len)`: to the connection when it owns its DCID, else to the listener. */
  datagram(at: i32, len: i32, now: i64): void {
    let dcidAt: i32 = at + 1;
    let dcidLength: i32 = QUIC_CONN_CID_LENGTH;
    if ((toI32(this.rx[at]) & 0x80) !== 0) {
      if (len < 6) {
        return;
      }
      dcidLength = toI32(this.rx[at + 5]);
      dcidAt = at + 6;
    }
    if (dcidLength > QUIC_MAX_CID_LENGTH || dcidAt + dcidLength > at + len) {
      return;
    }
    if (this.busy) {
      if (this.conn.ownsConnectionIdAt(this.rx, dcidAt, dcidLength)) {
        this.serveDatagram(at, len, now);
      }
      return;
    }
    const copy: u8[] = new Array<u8>(len);
    for (let k: i32 = 0; k < len; k++) {
      copy[k] = this.rx[at + k];
    }
    const answer: QuicListenerAnswer = this.listener.handle(copy, this.from, now);
    if (toI32(answer.reply.length) > 0) {
      udpSendTo(this.fd, answer.reply, n32(0), toI32(answer.reply.length), this.from, n32(0), n32(0));
    }
    if (answer.kind !== QUIC_LISTEN_ACCEPT) {
      return;
    }
    const fixed: u8[] = fixedEntropy();
    for (let k: i32 = 0; k < toI32(fixed.length) && k < toI32(this.entropy.length); k++) {
      this.entropy[k] = fixed[k];
    }
    this.conn.reset(this.entropy);
    for (let k: i32 = 0; k < 18; k++) {
      this.address[k] = this.from[k];
    }
    this.busy = true;
    this.accepted = this.accepted + 1;
    this.serveDatagram(at, len, now);
  }

  /** Hands the connection a datagram and signs when its handshake asks. */
  serveDatagram(at: i32, len: i32, now: i64): void {
    this.conn.receiveWindow(this.rx, at, len, now);
    const input: u8[] | null = this.conn.signatureInput();
    if (input !== null) {
      const key: Secret<u8[]> = lbLeafKey(this.leaf);
      const signature: u8[] | null = tlsSignEcdsaP256(key, input);
      wipe(key);
      if (signature !== null) {
        this.conn.sign(signature);
      }
    }
  }

  /** The program's turn. */
  serve(): void {
    if (this.busy) {
      this.app.serve(this.conn);
    }
  }

  /** Sends what the pacer lets out; once the connection has closed, its CONNECTION_CLOSE, and the slot is freed. */
  flush(now: i64): void {
    if (!this.busy) {
      return;
    }
    for (let guard: i32 = 0; guard < 64; guard++) {
      const n: i32 = quicListenerTakeFlight(this.conn, now, this.tx, n32(0), toI32(this.tx.length), this.flight);
      if (n <= 0) {
        break;
      }
      const segment: i32 = this.flight.count > 1 ? this.flight.segment : n32(0);
      udpSendTo(this.fd, this.tx, n32(0), n, this.address, segment, n32(0));
    }
    if (this.conn.closed()) {
      const n: i32 = this.conn.takeDatagramInto(this.tx, n32(0), now);
      if (n > 0) {
        udpSendTo(this.fd, this.tx, n32(0), n, this.address, n32(0), n32(0));
      }
      this.lastError = this.conn.error;
      this.lastErrorApp = this.conn.errorIsApplication;
      this.lastClosedByPeer = this.conn.state === QUIC_STATE_DRAINING;
      this.conn.release();
      this.app.table.forget(n32(0));
      this.busy = false;
    }
  }

  /** Milliseconds until the connection's next timer or pacer credit, or -1. */
  timeout(now: i64): i32 {
    if (!this.busy) {
      return -1;
    }
    let wait: i64 = n64(-1);
    const due: i64 = this.conn.deadline();
    if (due >= 0) {
      wait = due > now ? due - now : n64(0);
    }
    // `quicListenerPaceTime` answers when, not how long: the pacer's next credit on the caller's clock.
    const paced: i64 = quicListenerPaceTime(this.conn, now);
    if (paced > now && (wait < 0 || paced - now < wait)) {
      wait = paced - now;
    }
    return toI32(wait);
  }
}

/**
 * The client's socket and books: the QUIC client, the credit the server
 * gave it, each stream's next offset, and what it read that is not stream
 * data — DATAGRAM payloads and the CONNECTION_CLOSE.
 */
export class UdpClient {
  c: QcClient;
  frame: QuicFrame;
  to: u8[];
  rx: u8[];
  from: u8[];
  meta: i32[];
  ids: i64[];
  limits: i64[];
  offsets: i64[];
  datagrams: u8[][];
  fd: i32 = -1;
  /** The connection's credit and what the client has sent against it; the limits on its streams. */
  maxData: i64 = 0;
  sent: i64 = 0;
  maxStreamsBidi: i64 = 0;
  maxStreamsUni: i64 = 0;
  initialBidi: i64 = 0;
  initialUni: i64 = 0;
  /** The CONNECTION_CLOSE the client read: its code, and whether it was the application's; -1 until one comes. */
  closeCode: i64 = -1;
  scanned: i32 = 0;
  /** The largest 1-RTT packet number the client has acknowledged. */
  acked: i64 = -1;
  closeApp: boolean = false;

  constructor(port: i32) {
    this.c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
    this.frame = new QuicFrame();
    this.fd = udpBind("127.0.0.1", n32(0), n32(0));
    this.to = new Array<u8>(18);
    netAddress(this.to, "127.0.0.1", port);
    this.rx = new Array<u8>(65536);
    this.from = new Array<u8>(18);
    this.meta = [n32(0), n32(0)];
    this.ids = [];
    this.limits = [];
    this.offsets = [];
    this.datagrams = [];
  }

  /** The server's transport parameters, read out of its EncryptedExtensions; false when there are none. */
  learnParameters(): boolean {
    const messages: u8[][] = splitMessages(this.c.cryptoHandshake);
    if (toI32(messages.length) === 0 || toI32(messages[0][0]) !== 8) {
      return false;
    }
    const ee: u8[] = messages[0];
    let at: i32 = 6;
    while (at + 4 <= toI32(ee.length)) {
      const type: i32 = (toI32(ee[at]) << 8) | toI32(ee[at + 1]);
      const length: i32 = (toI32(ee[at + 2]) << 8) | toI32(ee[at + 3]);
      if (type === 0x39) {
        const body: u8[] = range(ee, at + 4, at + 4 + length);
        const p: QuicTransportParameters = quicParseTransportParameters(body, true);
        this.maxData = p.initialMaxData;
        this.maxStreamsBidi = p.initialMaxStreamsBidi;
        this.maxStreamsUni = p.initialMaxStreamsUni;
        this.initialBidi = p.initialMaxStreamDataBidiRemote;
        this.initialUni = p.initialMaxStreamDataUni;
        return p.error === n64(0);
      }
      at = at + 4 + length;
    }
    return false;
  }

  /** The record of stream `id`, made the first time with the credit a stream of its type starts with. */
  at(id: i64): i32 {
    for (let k: i32 = 0; k < toI32(this.ids.length); k++) {
      if (this.ids[k] === id) {
        return k;
      }
    }
    this.ids.push(id);
    this.limits.push((id & n64(2)) === n64(0) ? this.initialBidi : this.initialUni);
    this.offsets.push(n64(0));
    return toI32(this.ids.length) - 1;
  }

  /** Whether stream `id` may be opened: its number is under the server's MAX_STREAMS for its type. */
  mayOpen(id: i64): boolean {
    const limit: i64 = (id & n64(2)) === n64(0) ? this.maxStreamsBidi : this.maxStreamsUni;
    return id >> n64(2) < limit;
  }

  /** How many bytes stream `id` may carry now. */
  credit(id: i64): i64 {
    const k: i32 = this.at(id);
    const own: i64 = this.limits[k] - this.offsets[k];
    const conn: i64 = this.maxData - this.sent;
    return own < conn ? own : conn;
  }

  /** Reads the frames of every packet opened since the last call that are not stream data. */
  scan(): void {
    const f: QuicFrame = this.frame;
    while (this.scanned < toI32(this.c.appPayloads.length)) {
      const payload: u8[] = this.c.appPayloads[this.scanned];
      this.scanned = this.scanned + 1;
      let at: i32 = 0;
      while (at < toI32(payload.length)) {
        if (quicParseFrame(f, payload, at, toI32(payload.length)) !== n64(0) || f.end <= at) {
          break;
        }
        if (f.type === QUIC_FRAME_MAX_DATA && f.value > this.maxData) {
          this.maxData = f.value;
        } else if (f.type === QUIC_FRAME_MAX_STREAM_DATA) {
          const k: i32 = this.at(f.streamId);
          if (f.value > this.limits[k]) {
            this.limits[k] = f.value;
          }
        } else if (f.type === QUIC_FRAME_MAX_STREAMS_BIDI && f.value > this.maxStreamsBidi) {
          this.maxStreamsBidi = f.value;
        } else if (f.type === QUIC_FRAME_MAX_STREAMS_UNI && f.value > this.maxStreamsUni) {
          this.maxStreamsUni = f.value;
        } else if (f.type === QUIC_FRAME_DATAGRAM) {
          this.datagrams.push(range(payload, f.dataStart, f.dataStart + f.dataLength));
        } else if (f.type === QUIC_FRAME_CONNECTION_CLOSE || f.type === QUIC_FRAME_CONNECTION_CLOSE_APP) {
          this.closeCode = f.errorCode;
          this.closeApp = f.type === QUIC_FRAME_CONNECTION_CLOSE_APP;
        }
        at = f.end;
      }
    }
  }
}

/** The loop, the server of one carrier, its client, and what happened. */
export class UdpLoop {
  quic: QuicEchoServer | null = null;
  h3: Http3Server | null = null;
  wts: WebTransport[];
  h3App: H3App;
  wtApp: WtApp;
  client: UdpClient;
  ready: i32[];
  leaf: u8[];
  /** The first thing that went wrong, or empty. */
  failure: string = "";
  /** While set, what every server call keeps in the arena (see `LbMeter`). */
  meter: LbMeter | null = null;
  carrier: i32 = 0;
  loop: i32 = -1;
  serverFd: i32 = -1;
  port: i32 = 0;
  /** The last time anything moved, for the five-second bound. */
  moved: i64 = 0;

  /** A server of `carrier` on a loopback socket of its own, with `slots` slots for HTTP/3 and WebTransport. */
  constructor(carrier: i32, quicConfig: QuicServerConfig, h3Config: Http3Config, wtConfig: WebTransportConfig, slots: i32) {
    this.carrier = carrier;
    this.ready = new Array<i32>(8);
    this.leaf = leafPrivate();
    this.wts = [];
    this.loop = pollCreate();
    this.serverFd = udpBind("127.0.0.1", n32(0), n32(0));
    this.port = netLocalPort(this.serverFd);
    this.h3App = new H3App(carrier === CARRIER_H3 ? n32(8) : n32(0));
    this.wtApp = new WtApp(carrier === CARRIER_WT ? n32(8) : n32(0));
    if (carrier === CARRIER_QUIC) {
      const server = new QuicEchoServer(quicConfig, this.serverFd);
      this.quic = server;
    } else {
      const server = new Http3Server(quicConfig, h3Config, this.serverFd, slots, lbListenerEntropy());
      if (carrier === CARRIER_WT) {
        for (let k: i32 = 0; k < slots; k++) {
          this.wts.push(new WebTransport(wtConfig, server.connection(k)));
        }
      }
      this.h3 = server;
    }
    this.client = new UdpClient(this.port);
    pollAdd(this.loop, this.serverFd, n32(1), SERVER);
    pollAdd(this.loop, this.client.fd, n32(1), CLIENT);
    this.moved = lbNowMs();
  }

  /** Notes the first failure only. */
  fail(what: string): void {
    if (this.failure === "") {
      this.failure = what;
    }
  }

  /** A new client in place of the last, its socket in the loop. */
  newClient(): UdpClient {
    netClose(this.client.fd);
    this.client = new UdpClient(this.port);
    pollAdd(this.loop, this.client.fd, n32(1), CLIENT);
    return this.client;
  }

  /** Milliseconds until the server has a timer to run, or -1. */
  serverTimeout(now: i64): i32 {
    const q: QuicEchoServer | null = this.quic;
    if (q !== null) {
      return q.timeout(now);
    }
    const s: Http3Server | null = this.h3;
    return s !== null ? s.timeout(now) : n32(-1);
  }

  /**
   * One wait of the loop, at most `maxWait` milliseconds or until the
   * server's next timer: the server's round, each of its calls measured on
   * its own, then the client reads what came. True when anything moved.
   */
  step(maxWait: i32): boolean {
    let wait: i32 = maxWait;
    const timer: i32 = this.serverTimeout(lbNowMs());
    if (timer >= 0 && timer < wait) {
      wait = timer;
    }
    const n: i32 = pollWait(this.loop, this.ready, wait);
    let serverReady: boolean = false;
    let clientReady: boolean = false;
    for (let i: i32 = 0; i < n; i++) {
      serverReady = serverReady || this.ready[2 * i] === SERVER;
      clientReady = clientReady || this.ready[2 * i] === CLIENT;
    }
    const now: i64 = lbNowMs();
    this.serverRound(now, serverReady);
    const read: i32 = clientReady ? this.clientRead() : n32(0);
    if (n > 0 || read > 0) {
      this.moved = now;
    } else if (now - this.moved > n64(5000)) {
      this.fail("timed out: nothing moved for five seconds");
    }
    return n > 0;
  }

  /** The server's round at `now`: read the socket when it is readable, the program's turn, flush. */
  serverRound(now: i64, readable: boolean): void {
    const q: QuicEchoServer | null = this.quic;
    const m: LbMeter | null = this.meter;
    if (q !== null) {
      if (readable) {
        lbBegin(m);
        q.receive(now);
        lbEnd(m);
      }
      lbBegin(m);
      q.serve();
      lbEnd(m);
      lbBegin(m);
      q.flush(now);
      lbEnd(m);
      return;
    }
    const s: Http3Server | null = this.h3;
    if (s === null) {
      return;
    }
    if (readable) {
      // `receive` borrows the leaf key as a `Secret`, which only a fresh value
      // can be and no field can hold. The relay holds one as a local of its
      // loop for its whole life; this loop is a method, so it makes the copy
      // for each wake, outside the measured call.
      const key: Secret<u8[]> = lbLeafKey(this.leaf);
      lbBegin(m);
      s.receive(now, key);
      lbEnd(m);
      wipe(key);
    }
    lbBegin(m);
    s.tick(now);
    lbEnd(m);
    lbBegin(m);
    this.answer(s);
    lbEnd(m);
    lbBegin(m);
    s.flush(now);
    lbEnd(m);
    for (let slot: i32 = 0; slot < s.size(); slot++) {
      if (!s.holds(slot)) {
        this.h3App.table.forget(slot);
        this.wtApp.table.forget(slot);
      }
    }
  }

  /** Every slot with news, its events answered by the carrier's program. */
  answer(s: Http3Server): void {
    let slot: i32 = s.ready();
    while (slot >= 0) {
      if (this.carrier === CARRIER_WT) {
        const wt: WebTransport = this.wts[slot];
        let event: i32 = wt.next();
        while (event !== H3_NEED_MORE && event !== H3_ERROR) {
          this.wtApp.serve(wt, slot, event);
          event = wt.next();
        }
      } else {
        const h3: Http3Connection = s.connection(slot);
        let event: i32 = h3.next();
        while (event !== H3_NEED_MORE && event !== H3_ERROR) {
          this.h3App.handle(h3, event, slot);
          event = h3.next();
        }
      }
      slot = s.ready();
    }
  }

  /** Reads every datagram on the client's socket and opens it; acknowledges what came in 1-RTT. Answers how many. */
  clientRead(): i32 {
    const cl: UdpClient = this.client;
    let read: i32 = 0;
    let n: i32 = udpRecvFrom(cl.fd, cl.rx, n32(0), toI32(cl.rx.length), cl.from, cl.meta);
    while (n >= 0) {
      const segment: i32 = cl.meta[0] > 0 ? cl.meta[0] : n;
      for (let at: i32 = 0; at < n && segment > 0; at += segment) {
        const length: i32 = n - at < segment ? n - at : segment;
        const datagram: u8[] = range(cl.rx, at, at + length);
        cl.c.datagrams.push(datagram);
        if (qcReceive(cl.c, datagram) === 0) {
          this.fail("the client could not open a datagram the server sent");
        }
        read++;
      }
      n = udpRecvFrom(cl.fd, cl.rx, n32(0), toI32(cl.rx.length), cl.from, cl.meta);
    }
    cl.scan();
    if (cl.c.appWrite !== null && cl.c.largestApp > cl.acked) {
      const none: u8[] = [];
      this.packet(none);
    }
    return read;
  }

  /** Sends `datagram` from the client's socket. */
  sendDatagram(datagram: u8[]): void {
    const cl: UdpClient = this.client;
    udpSendTo(cl.fd, datagram, n32(0), toI32(datagram.length), cl.to, n32(0), n32(0));
  }

  /** A 1-RTT packet of `payload` from the client, behind an ACK of everything it has received. */
  packet(payload: u8[]): void {
    const cl: UdpClient = this.client;
    const all: u8[] = [];
    if (cl.c.largestApp >= 0) {
      quicPushAck(all, [n64(0), cl.c.largestApp], n32(1), n64(0));
      cl.acked = cl.c.largestApp;
    }
    for (const b of payload) {
      all.push(b);
    }
    this.sendDatagram(qcShort(cl.c, all));
  }

  /**
   * The client's handshake: `hello` (carrying its transport parameters) in
   * a padded Initial, the server's flight read and checked as it arrives,
   * the client's Finished, and the server's parameters learnt. False on a
   * timeout or a flight that does not verify.
   */
  connect(hello: u8[]): boolean {
    const c: QcClient = this.client.c;
    c.before = hello;
    const from: i32 = toI32(c.datagrams.length);
    this.sendDatagram(qcInitial(c, qcCrypto(n64(0), hello), n32(1200)));
    let tried: i32 = 0;
    let flight: boolean = false;
    for (let rounds: i32 = 0; rounds < 1000 && !flight && this.failure === ""; rounds++) {
      this.step(n32(20));
      if (toI32(c.datagrams.length) > tried && toI32(c.cryptoInitial.length) > 0) {
        tried = toI32(c.datagrams.length);
        flight = qcReadFlight(c, from, n32(0));
      }
    }
    if (!flight) {
      this.fail("the client could not read the server's flight");
      return false;
    }
    this.sendDatagram(qcFinishedPacket(c));
    for (let rounds: i32 = 0; rounds < 1000 && c.largestApp < 0 && this.failure === ""; rounds++) {
      this.step(n32(20));
    }
    return this.client.learnParameters() && c.largestApp >= 0;
  }

  /**
   * Sends all of `bytes` on stream `id`, and the FIN after it when `fin`:
   * opened only under the server's MAX_STREAMS, in packets of at most 1,000
   * bytes, each within the credit the server gave, running the loop while
   * there is none. False on a timeout.
   */
  sendStream(id: i64, bytes: u8[], fin: boolean): boolean {
    const cl: UdpClient = this.client;
    while (!cl.mayOpen(id)) {
      this.step(n32(20));
      if (this.failure !== "") {
        return false;
      }
    }
    let at: i32 = 0;
    const total: i32 = toI32(bytes.length);
    for (let rounds: i32 = 0; rounds < 1000000 && this.failure === ""; rounds++) {
      const credit: i64 = cl.credit(id);
      let n: i32 = total - at < CHUNK ? total - at : CHUNK;
      if (toI64(n) > credit) {
        n = credit > 0 ? toI32(credit) : n32(0);
      }
      const last: boolean = at + n === total;
      if (n > 0 || (last && fin)) {
        const payload: u8[] = [];
        const k: i32 = cl.at(id);
        quicPushStream(payload, id, cl.offsets[k], bytes, at, n, last && fin);
        cl.offsets[k] = cl.offsets[k] + toI64(n);
        cl.sent = cl.sent + toI64(n);
        at = at + n;
        this.packet(payload);
        if (last) {
          return true;
        }
        if (rounds % 16 === 15) {
          this.step(n32(0));
        }
      } else {
        this.step(n32(20));
      }
    }
    return false;
  }

  /** Sends one DATAGRAM frame carrying `data` as it is. */
  sendQuicDatagram(data: u8[]): void {
    const size: i32 = quicDatagramSize(toI32(data.length));
    const frame: u8[] = new Array<u8>(size);
    quicPutDatagram(frame, n32(0), size, data, n32(0), toI32(data.length));
    this.packet(frame);
  }

  /** The client closes the connection with the application's `code`. */
  closeConnection(code: i64): void {
    const payload: u8[] = [];
    const none: u8[] = [];
    quicPushConnectionClose(payload, true, code, n64(0), none);
    this.packet(payload);
  }

  /** Sends `data` as one DATAGRAM frame and runs the loop until one more comes back: answers it, or an empty array on a timeout. */
  datagramRoundTrip(data: u8[]): u8[] {
    const base: i32 = toI32(this.client.datagrams.length);
    this.sendQuicDatagram(data);
    const none: u8[] = [];
    return this.awaitDatagrams(base + 1) ? this.client.datagrams[base] : none;
  }

  /** Runs the loop until the client holds `n` datagrams; false on a timeout. */
  awaitDatagrams(n: i32): boolean {
    while (toI32(this.client.datagrams.length) < n && this.failure === "") {
      this.step(n32(20));
    }
    return toI32(this.client.datagrams.length) >= n;
  }

  /** Runs the loop until the client has read a CONNECTION_CLOSE; false on a timeout. */
  awaitClose(): boolean {
    while (this.client.closeCode < 0 && this.failure === "") {
      this.step(n32(20));
    }
    return this.client.closeCode >= 0;
  }

  /** Runs the loop until the server holds no connection; false on a timeout. */
  awaitIdle(): boolean {
    while (this.busy() > 0 && this.failure === "") {
      this.step(n32(20));
    }
    return this.busy() === 0;
  }

  /** How many connections the server holds. */
  busy(): i32 {
    const q: QuicEchoServer | null = this.quic;
    if (q !== null) {
      return q.busy ? n32(1) : n32(0);
    }
    const s: Http3Server | null = this.h3;
    return s !== null ? s.busy() : n32(0);
  }

  /** Closes both sockets and the loop. */
  shutdown(): void {
    netClose(this.client.fd);
    netClose(this.serverFd);
    netClose(this.loop);
  }
}
