// The TCP half of the loopback suite: one `pollWait` loop that holds a Nish
// server on one carrier — `nish/net/tls-tcp`, `nish/net/http1-server`'s TLS
// pool, or `nish/net/http2-tls` — and the Nish clients that talk to it. The
// kernel carries every byte: a client writes to its socket, the loop wakes
// the server's descriptor, and what the server sends is read off the client's
// socket when the loop wakes it.
//
// The server side is a program as the relay would write one: accept into a
// slot, re-arm each descriptor with the interest the carrier answers, sign
// when the handshake asks, answer the connection's events, close the slot
// when it is done. Its answers (`apps.ts`) allocate nothing per request or
// per byte, so the whole of a server wake, carrier and program together, is
// what the loop's `meter` measures. Every wait is bounded: five seconds without a wake
// is a failure, never a hang.
import { Secret, secret, wipe } from "nish:secret";
import {
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollModify,
  pollRemove,
  pollWait,
  tcpConnect,
  tcpListen,
} from "nish:net";
import { TLS_RECORD_DONE, TLS_RECORD_SIGN } from "nish/net/tls/record-server";
import { TLS_TCP_POOL_FULL, TlsTcpServer } from "nish/net/tls-tcp";
import { H1_ALPN, H1_DONE, H1_ERROR, H1_NEED_MORE, Http1Config, Http1Connection, Http1TlsServer } from "nish/net/http1-server";
import { H2_ALPN, Http2TlsServer } from "nish/net/http2-tls";
import { H2_ERROR, H2_NEED_MORE, Http2Config } from "nish/net/http2";
import { leafPrivate, serverPrivate, tcpConfig } from "../net_tls_common/server";
import { ZERO } from "../net_tls_record_common/bytes";
import { CLIENTS, LISTENER, Peer } from "../net_tls_record_tcp/harness";
import { LbMeter } from "./common";
import { EchoSlots, H1App, H2App } from "./apps";

const WOULD_BLOCK: i32 = -11;

/** Which carrier the loop's server runs. */
export const CARRIER_TLS: i32 = 0;
export const CARRIER_H1: i32 = 1;
export const CARRIER_H2: i32 = 2;

/** The slots every pool here has: one connection under test, and room for the next while the last closes. */
const POOL: i32 = 2;

/** The caps of the HTTP/1.1 server: buffers far smaller than any body the suite sends. */
export const h1Config = (): Http1Config => {
  const config = new Http1Config();
  config.maxTarget = 256;
  config.maxHeaderBytes = 1024;
  config.maxHeaders = 32;
  config.maxBody = 4194304;
  config.chunkSize = 4096;
  config.outputSize = 8192;
  config.maxMessage = 262144;
  config.idleTimeout = 5000;
  return config;
};

/** The loop, the server of one carrier, its clients, and what happened. */
export class TcpLoop {
  carrier: i32 = 0;
  loop: i32 = -1;
  listener: i32 = -1;
  port: i32 = 0;
  /** The carrier's pool: only the one `carrier` names is used; the others are made with one slot and never accept. */
  tls: TlsTcpServer;
  h1: Http1TlsServer;
  h2: Http2TlsServer;
  echo: EchoSlots;
  h1App: H1App;
  h2App: H2App;
  ready: i32[];
  peers: Peer[];
  buf: u8[];
  keyBuffer: u8[];
  randomBuffer: u8[];
  /** The server's ephemeral key every accept is handed, copied into `keyBuffer`, which accept wipes. */
  serverKey: u8[];
  /** The P-256 leaf key, as the program holds it. */
  leafKey: u8[];
  /** The first thing that went wrong, or empty. */
  failure: string = "";
  accepted: i32 = 0;
  refused: i32 = 0;
  closed: i32 = 0;
  /** While set, what every server wake — the accept, the carrier's calls and the program's answers — keeps in the arena. */
  meter: LbMeter | null = null;
  none: u8[];

  constructor(carrier: i32) {
    this.carrier = carrier;
    this.ready = new Array<i32>(32);
    this.peers = [];
    this.buf = new Array<u8>(65536);
    this.keyBuffer = new Array<u8>(32);
    this.randomBuffer = new Array<u8>(32);
    this.serverKey = serverPrivate();
    this.leafKey = leafPrivate();
    this.none = [];
    this.loop = pollCreate();
    this.listener = tcpListen("127.0.0.1", ZERO, toI32(16));
    this.port = netLocalPort(this.listener);
    const unused: i32 = -1;
    this.tls = new TlsTcpServer(tcpConfig([]), carrier === CARRIER_TLS ? this.listener : unused, carrier === CARRIER_TLS ? POOL : toI32(1));
    this.h1 = new Http1TlsServer(tcpConfig([H1_ALPN]), h1Config(), carrier === CARRIER_H1 ? this.listener : unused, carrier === CARRIER_H1 ? POOL : toI32(1));
    this.h2 = new Http2TlsServer(tcpConfig([H2_ALPN]), new Http2Config(), carrier === CARRIER_H2 ? this.listener : unused, carrier === CARRIER_H2 ? POOL : toI32(1));
    this.echo = new EchoSlots(POOL);
    this.h1App = new H1App(POOL);
    this.h2App = new H2App();
    pollAdd(this.loop, this.listener, toI32(1), LISTENER);
  }

  /** Notes the first failure only. */
  fail(what: string): void {
    if (this.failure === "") {
      this.failure = what;
    }
  }

  /** A new client, connected through the loop; its index, or -1. */
  connect(): i32 {
    const addr: u8[] = new Array<u8>(18);
    netAddress(addr, "127.0.0.1", this.port);
    const index: i32 = toI32(this.peers.length);
    const peer = new Peer(CLIENTS + index);
    peer.fd = tcpConnect(addr);
    this.peers.push(peer);
    if (peer.fd < 0) {
      this.fail(`tcpConnect ${peer.fd}`);
      return -1;
    }
    pollAdd(this.loop, peer.fd, toI32(2), peer.token);
    let connected: boolean = false;
    for (let rounds: i32 = 0; rounds < 100 && !connected && this.failure === ""; rounds++) {
      connected = this.step(peer.token);
    }
    const result: i32 = connectResult(peer.fd);
    if (!connected || result !== 0) {
      this.fail(`connect: ${result}`);
      return -1;
    }
    pollModify(this.loop, peer.fd, toI32(1), peer.token);
    return index;
  }

  /** One wait of the loop; true when `token` was among those ready. Five seconds with nothing is a failure. */
  step(token: i32): boolean {
    const n: i32 = pollWait(this.loop, this.ready, toI32(5000));
    if (n <= 0) {
      this.fail("timed out: a wake was lost");
      return false;
    }
    let seen: boolean = false;
    for (let i: i32 = 0; i < n; i++) {
      const who: i32 = this.ready[2 * i];
      const events: i32 = this.ready[2 * i + 1];
      seen = seen || who === token;
      if (who === LISTENER) {
        this.acceptAll();
      } else if (who >= CLIENTS) {
        this.readPeer(who - CLIENTS);
      } else {
        this.serve(who, events);
      }
    }
    return seen;
  }

  /** Everything waiting on a client's socket into its `got`. */
  readPeer(index: i32): void {
    const peer: Peer = this.peers[index];
    if (peer.ended || peer.fd < 0) {
      return;
    }
    while (true) {
      const n: i32 = netRead(peer.fd, this.buf, ZERO, toI32(this.buf.length));
      if (n <= 0) {
        if (n !== WOULD_BLOCK) {
          peer.ended = true;
          peer.failure = n;
          pollRemove(this.loop, peer.fd);
        }
        return;
      }
      for (let k: i32 = 0; k < n; k++) {
        peer.got.push(this.buf[k]);
      }
    }
  }

  /** Accepts every waiting connection into the carrier's pool, with the test randomness. */
  acceptAll(): void {
    while (true) {
      for (let k: i32 = 0; k < 32; k++) {
        this.keyBuffer[k] = this.serverKey[k];
        this.randomBuffer[k] = toU8(0x40 + this.accepted);
      }
      const filler: u8[] = this.filler();
      const before: i64 = Arena.used();
      let slot: i32 = -1;
      if (this.carrier === CARRIER_TLS) {
        slot = this.tls.accept(this.randomBuffer, this.keyBuffer);
      } else if (this.carrier === CARRIER_H1) {
        slot = this.h1.accept(this.randomBuffer, this.keyBuffer);
      } else {
        slot = this.h2.accept(this.randomBuffer, this.keyBuffer);
      }
      if (slot >= 0) {
        this.track(before, filler);
        this.accepted = this.accepted + 1;
        this.echo.reset(slot);
        this.h1App.reset(slot);
        this.h2App.table.forget(slot);
        pollAdd(this.loop, this.fd(slot), toI32(1), slot);
      } else if (slot === TLS_TCP_POOL_FULL) {
        this.refused = this.refused + 1;
      } else {
        return;
      }
    }
  }

  /** What the meter starts a measured call with (see `LbMeter`); nothing while none is set. */
  filler(): u8[] {
    const m: LbMeter | null = this.meter;
    return m !== null ? m.filler() : this.none;
  }

  /** While a meter is set, counts what the call since `before` kept. */
  track(before: i64, filler: u8[]): void {
    const m: LbMeter | null = this.meter;
    if (m !== null) {
      m.add(before, filler);
    }
  }

  /** The descriptor of `slot` in the carrier's pool. */
  fd(slot: i32): i32 {
    if (this.carrier === CARRIER_TLS) {
      return this.tls.fd(slot);
    }
    return this.carrier === CARRIER_H1 ? this.h1.fd(slot) : this.h2.fd(slot);
  }

  /** A connection's descriptor is ready: the carrier's own wake. */
  serve(slot: i32, events: i32): void {
    const filler: u8[] = this.filler();
    const before: i64 = Arena.used();
    let wants: i32 = 0;
    let holds: boolean = false;
    let done: boolean = false;
    if (this.carrier === CARRIER_TLS) {
      wants = this.serveTls(slot, events);
      holds = this.tls.holds(slot);
      done = (wants & TLS_RECORD_DONE) !== 0;
    } else if (this.carrier === CARRIER_H1) {
      wants = this.serveH1(slot, events);
      holds = this.h1.holds(slot);
      done = (wants & H1_DONE) !== 0;
    } else {
      wants = this.serveH2(slot, events);
      holds = this.h2.holds(slot);
      done = (wants & TLS_RECORD_DONE) !== 0;
    }
    this.track(before, filler);
    if (!holds) {
      return;
    }
    if (done) {
      this.closeSlot(slot);
      return;
    }
    pollModify(this.loop, this.fd(slot), wants & 3, slot);
  }

  /** Closes `slot` once its connection is done, as the program does. */
  closeSlot(slot: i32): void {
    if (this.carrier === CARRIER_TLS) {
      this.tls.close(slot);
    } else if (this.carrier === CARRIER_H1) {
      this.h1.close(slot);
    } else {
      this.h2.close(slot);
    }
    this.closed = this.closed + 1;
  }

  /**
   * The leaf key as a `Secret` for one signature, which the caller wipes: a
   * fresh copy, since `secret` takes only a value nothing else holds. What a
   * server that keeps its key does per handshake, so it is counted with the
   * server's wake.
   */
  leaf(): Secret<u8[]> {
    const copy: u8[] = new Array<u8>(32);
    for (let k: i32 = 0; k < 32; k++) {
      copy[k] = this.leafKey[k];
    }
    return secret(copy);
  }

  /** TLS over TCP: an echo of everything the client sends, held when the carrier cannot take it yet. */
  serveTls(slot: i32, events: i32): i32 {
    let wants: i32 = (events & 5) !== 0 ? this.tls.readable(slot) : this.tls.writable(slot);
    if ((wants & TLS_RECORD_SIGN) !== 0) {
      const key: Secret<u8[]> = this.leaf();
      wants = this.tls.signP256(slot, key);
      wipe(key);
    }
    if (this.tls.holds(slot) && (wants & TLS_RECORD_DONE) === 0) {
      wants = this.echo.pump(this.tls, slot);
    }
    return wants;
  }

  /** HTTP/1.1 and WebSocket over TLS: the carrier's events, answered by `H1App`. */
  serveH1(slot: i32, events: i32): i32 {
    const wants: i32 = (events & 5) !== 0 ? this.h1.readable(slot) : this.h1.writable(slot);
    if ((wants & TLS_RECORD_SIGN) !== 0) {
      const key: Secret<u8[]> = this.leaf();
      this.h1.signP256(slot, key);
      wipe(key);
    }
    const conn: Http1Connection = this.h1.connection(slot);
    let event: i32 = this.h1.next(slot);
    while (event !== H1_NEED_MORE) {
      this.h1App.handle(conn, event, slot);
      if (event === H1_ERROR) {
        break;
      }
      event = this.h1.next(slot);
    }
    return this.h1.flush(slot);
  }

  /** HTTP/2 over TLS: the carrier's events, answered by `H2App`. */
  serveH2(slot: i32, events: i32): i32 {
    const wants: i32 = (events & 5) !== 0 ? this.h2.readable(slot) : this.h2.writable(slot);
    if ((wants & TLS_RECORD_SIGN) !== 0) {
      const key: Secret<u8[]> = this.leaf();
      this.h2.signP256(slot, key);
      wipe(key);
    }
    let event: i32 = this.h2.next(slot);
    while (event !== H2_NEED_MORE && event !== H2_ERROR) {
      this.h2App.handle(this.h2.connection(slot), event, slot);
      event = this.h2.next(slot);
    }
    // A window may have opened, or the output drained, without an event that says so.
    this.h2App.resume(this.h2.connection(slot), slot);
    return this.h2.flush(slot);
  }

  /** Sends `bytes[from .. to)` from client `index`, running the loop while its socket is full. */
  sendRange(index: i32, bytes: u8[], from: i32, to: i32): void {
    const peer: Peer = this.peers[index];
    let sent: i32 = from;
    for (let rounds: i32 = 0; sent < to && rounds < 100000 && this.failure === ""; rounds++) {
      const w: i32 = netWrite(peer.fd, bytes, sent, to - sent);
      if (w > 0) {
        sent = sent + w;
      } else if (w !== WOULD_BLOCK) {
        this.fail(`client write ${w}`);
        return;
      } else {
        this.step(toI32(-1));
      }
    }
  }

  /** Sends every byte of `bytes` from client `index`. */
  send(index: i32, bytes: u8[]): void {
    this.sendRange(index, bytes, ZERO, toI32(bytes.length));
  }

  /** Runs the loop until client `index` holds at least `n` bytes, or its stream has ended; false on a timeout. */
  awaitBytes(index: i32, n: i32): boolean {
    const peer: Peer = this.peers[index];
    while (toI32(peer.got.length) < n && !peer.ended) {
      this.step(toI32(-1));
      if (this.failure !== "") {
        return false;
      }
    }
    return toI32(peer.got.length) >= n;
  }

  /** The next whole TLS record client `index` receives, header and all; empty on a timeout or the end of its stream. */
  nextRecord(index: i32): u8[] {
    const none: u8[] = [];
    if (!this.awaitBytes(index, toI32(5))) {
      return none;
    }
    const got: u8[] = this.peers[index].got;
    const length: i32 = (toI32(got[3]) << 8) | toI32(got[4]);
    if (!this.awaitBytes(index, 5 + length)) {
      return none;
    }
    return this.peers[index].take(5 + length);
  }

  /** Runs the loop until client `index`'s stream ends; false on a timeout. */
  awaitEnd(index: i32): boolean {
    const peer: Peer = this.peers[index];
    while (!peer.ended) {
      this.step(toI32(-1));
      if (this.failure !== "") {
        return false;
      }
    }
    return true;
  }

  /** Runs the loop until the server has closed `count` connections in all. */
  awaitClosed(count: i32): boolean {
    while (this.closed < count) {
      this.step(toI32(-1));
      if (this.failure !== "") {
        return false;
      }
    }
    return true;
  }

  /** How many slots of the carrier's pool hold a connection. */
  busy(): i32 {
    if (this.carrier === CARRIER_TLS) {
      return this.tls.busy();
    }
    return this.carrier === CARRIER_H1 ? this.h1.busy() : this.h2.busy();
  }

  /** Closes every socket the loop made. */
  shutdown(): void {
    for (const peer of this.peers) {
      if (peer.fd >= 0) {
        netClose(peer.fd);
        peer.fd = -1;
      }
    }
    for (let slot: i32 = 0; slot < POOL; slot++) {
      this.tls.close(slot);
      this.h1.close(slot);
      this.h2.close(slot);
    }
    netClose(this.listener);
    netClose(this.loop);
  }
}
