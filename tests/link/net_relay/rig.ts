// The relay across loopback, in one loop: `examples/relay/relay.ts`'s
// `Relay` on a UDP socket of its own, a Nish UDP "game server" that echoes
// what it is sent, and WebTransport clients, each on a socket of its own.
// The client is `net_webtransport/peer.ts`'s, reused by import: its QUIC
// client (`net_quic_conn/client.ts`), its transport parameters and
// `wtransport` 0.7's SETTINGS, and `net_http3/peer.ts`'s frames, with only
// the socket and a distinct connection ID per client added here. The relay's
// clocks are the rig's: `now` moves only when a check moves it, so the
// timeouts are driven, not waited for.
import { netAddress, netLocalPort, udpBind, udpRecvFrom, udpSendTo } from "nish:net";
import { Secret, secret, wipe } from "nish:secret";
import {
  QUIC_FRAME_CONNECTION_CLOSE,
  QUIC_FRAME_CONNECTION_CLOSE_APP,
  QUIC_FRAME_DATAGRAM,
  QUIC_FRAME_STREAM,
  QuicFrame,
  quicDatagramSize,
  quicParseFrame,
  quicPushAck,
  quicPushStream,
  quicPutDatagram,
} from "nish/net/quic-frame";
import { QuicTransportParameters, quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { QPACK_OK, QpackDecoder, QpackEncoder } from "nish/net/qpack";
import { H3_FRAME_HEADERS, H3_STREAM_CONTROL, H3_STREAM_QPACK_DECODER, H3_STREAM_QPACK_ENCODER, Http3FrameHeader, h3ReadFrameHeader } from "nish/net/http3-frame";
import { H3_ALPN } from "nish/net/http3";
import { GrantVerifier } from "../../../examples/relay/grant";
import { Relay, RelayConfig, relayQuicConfig } from "../../../examples/relay/relay";
import { RELAY_HELLO, RELAY_PROTOCOL_VERSION } from "../../../examples/relay/frame";
import { bytesOf, fromHex, textOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafCertificate, leafPrivate } from "../net_tls_common/server";
import { QcClient, qcCrypto, qcFinishedPacket, qcHello, qcInitial, qcReadFlight, qcReceive, qcRetried, qcShort } from "../net_quic_conn/client";
import { CLIENT_CONTROL, CLIENT_DECODER, CLIENT_ENCODER, h3Cat, h3Frame, h3Section, h3Varint } from "../net_http3/peer";
import { wtClientSettingIds, wtClientSettingValues, wtSettingsFrame } from "../net_webtransport/peer";
import { SECRET, signGrant } from "./grants";

/** The Unix millisecond the rig's wall clock starts at: grant.rs's `now`. */
export const RIG_WALL: i64 = 1700000000000;

/** A grant for `host:port`, good until long after the rig's wall clock, signed with grant.rs's SECRET. */
export const rigGrant = (host: string, port: i32): string =>
  signGrant(`{"host":"${host}","port":${port},"expiresAt":4102444800000,"nonce":"rig"}`, SECRET);

/** A HELLO carrying `token` at protocol version `version`. */
export const rigHello = (token: string, version: i32): u8[] => {
  const out: u8[] = [toU8(RELAY_HELLO), toU8(version)];
  for (const b of bytesOf(token)) {
    out.push(b);
  }
  out.push(toU8(0));
  return out;
};

/**
 * A relay under `config` on the UDP socket `fd`, serving `net_tls_common`'s
 * P-256 test certificate (which the test client checks) and verifying grants
 * with grant.rs's SECRET.
 */
export const rigRelay = (config: RelayConfig, fd: i32, entropy: u8[]): Relay =>
  new Relay(config, relayQuicConfig([leafCertificate()], new Array<u8>(32), new Array<u8>(32)), fd, new GrantVerifier(bytesOf(SECRET)), entropy);

/** The game server: a UDP socket that records what it is sent and, unless silent, sends it back. */
export class RigEcho {
  fd: i32 = -1;
  port: i32 = 0;
  rx: u8[];
  from: u8[];
  meta: i32[];
  /** The length of each datagram it was sent, a GRO read cut at its segment size. */
  lengths: i32[];
  /** How many reads arrived coalesced (a segment size above 0). */
  coalesced: i32 = 0;
  silent: boolean = false;
  /** A payload it sends to the last sender once, as one GSO send of `segment`-byte datagrams, when set. */
  burst: u8[];
  burstSegment: i32 = 0;
  last: u8[];

  constructor(gro: boolean) {
    this.fd = udpBind("127.0.0.1", n32(0), gro ? n32(2) : n32(0));
    this.port = netLocalPort(this.fd);
    this.rx = new Array<u8>(65536);
    this.from = new Array<u8>(18);
    this.last = new Array<u8>(18);
    this.meta = [n32(0), n32(0)];
    this.lengths = [];
    this.burst = [];
  }

  /** The lengths it was sent, space-separated. */
  seen(): string {
    const parts: string[] = [];
    for (const n of this.lengths) {
      parts.push(`${n}`);
    }
    return parts.join(" ");
  }

  /** Reads and answers everything waiting; answers how many reads. */
  serve(): i32 {
    let reads: i32 = 0;
    let n: i32 = udpRecvFrom(this.fd, this.rx, n32(0), n32(65536), this.from, this.meta);
    while (n >= 0) {
      reads++;
      for (let k: i32 = 0; k < 18; k++) {
        this.last[k] = this.from[k];
      }
      const segment: i32 = this.meta[0] > 0 ? this.meta[0] : n;
      if (this.meta[0] > 0) {
        this.coalesced = this.coalesced + 1;
      }
      for (let at: i32 = 0; at < n && segment > 0; at = at + segment) {
        this.lengths.push(n - at < segment ? n - at : segment);
      }
      if (n === 0) {
        this.lengths.push(n32(0));
      }
      if (!this.silent) {
        udpSendTo(this.fd, this.rx, n32(0), n, this.from, this.meta[0] > 0 ? this.meta[0] : n32(0), n32(0));
      }
      n = udpRecvFrom(this.fd, this.rx, n32(0), n32(65536), this.from, this.meta);
    }
    if (toI32(this.burst.length) > 0) {
      udpSendTo(this.fd, this.burst, n32(0), toI32(this.burst.length), this.last, this.burstSegment, n32(0));
      this.burst = [];
    }
    return reads;
  }

  /** Sends `payload` to whoever last sent it a datagram. */
  reply(payload: u8[]): void {
    udpSendTo(this.fd, payload, n32(0), toI32(payload.length), this.last, n32(0), n32(0));
  }
}

/** One WebTransport client of the relay, on a socket of its own. */
export class RigClient {
  c: QcClient;
  fd: i32 = -1;
  to: u8[];
  rx: u8[];
  from: u8[];
  meta: i32[];
  frame: QuicFrame;
  enc: QpackEncoder;
  dec: QpackDecoder;
  header: Http3FrameHeader;
  /** The payload of every HTTP datagram of the session the relay sent, the quarter stream ID taken off. */
  datagrams: u8[][];
  /** What the relay sent on the CONNECT stream, and on the client's second bidirectional stream. */
  connect: u8[];
  second: u8[];
  /** The CONNECTION_CLOSE the client received, and whether it was the application's; -1 until one comes. */
  closeCode: i64 = -1;
  closeApp: boolean = false;
  seen: i32 = 0;
  /** How many 1-RTT packets the client last acknowledged, and how many bytes it wrote on the CONNECT stream. */
  acked: i64 = -1;
  connectSent: i64 = 0;
  connected: boolean = false;

  /** A client numbered `index` (which gives it its own connection IDs), sending from `host`, of the relay on `port`. */
  constructor(index: i32, host: string, port: i32) {
    const scid: u8[] = fromHex("c0c1c2c3");
    const odcid: u8[] = fromHex("00010203");
    for (let k: i32 = 3; k >= 0; k--) {
      scid.push(toU8((index >> (8 * k)) & 255));
      odcid.push(toU8((index >> (8 * k)) & 255));
    }
    this.c = new QcClient(TLS_AES_128_GCM_SHA256, scid);
    const none: u8[] = [];
    qcRetried(this.c, odcid, none);
    this.fd = udpBind(host, n32(0), n32(0));
    this.to = new Array<u8>(18);
    netAddress(this.to, "127.0.0.1", port);
    this.rx = new Array<u8>(65536);
    this.from = new Array<u8>(18);
    this.meta = [n32(0), n32(0)];
    this.frame = new QuicFrame();
    this.enc = new QpackEncoder();
    this.dec = new QpackDecoder(n32(65536));
    this.header = new Http3FrameHeader();
    this.datagrams = [];
    this.connect = [];
    this.second = [];
  }

  /** The ClientHello: h3, `net_webtransport`'s transport parameters with this client's SCID, DATAGRAM frames. */
  hello(): u8[] {
    const p = new QuicTransportParameters();
    p.initialScid = this.c.scid;
    p.hasInitialScid = true;
    p.initialMaxData = n64(67108864);
    p.initialMaxStreamDataBidiLocal = n64(1048576);
    p.initialMaxStreamDataBidiRemote = n64(65536);
    p.initialMaxStreamDataUni = n64(65536);
    p.initialMaxStreamsBidi = n64(8);
    p.initialMaxStreamsUni = n64(16);
    p.activeConnectionIdLimit = n64(4);
    p.maxDatagramFrameSize = n64(65535);
    return qcHello([TLS_AES_128_GCM_SHA256], H3_ALPN, quicEncodeTransportParameters(p));
  }

  /** Sends `datagram` to the relay. */
  transmit(datagram: u8[]): void {
    udpSendTo(this.fd, datagram, n32(0), toI32(datagram.length), this.to, n32(0), n32(0));
  }

  /** A 1-RTT packet of an ACK of everything received, then `payload`. */
  packet(payload: u8[]): void {
    const all: u8[] = [];
    if (this.c.largestApp >= 0) {
      quicPushAck(all, [n64(0), this.c.largestApp], n32(1), n64(0));
      this.acked = this.c.largestApp;
    }
    for (const b of payload) {
      all.push(b);
    }
    this.transmit(qcShort(this.c, all));
  }

  /** Reads every datagram waiting, and files what the relay sent. Answers how many. */
  read(): i32 {
    let reads: i32 = 0;
    let n: i32 = udpRecvFrom(this.fd, this.rx, n32(0), n32(65536), this.from, this.meta);
    while (n >= 0) {
      const segment: i32 = this.meta[0] > 0 ? this.meta[0] : n;
      for (let at: i32 = 0; at < n && segment > 0; at = at + segment) {
        const len: i32 = n - at < segment ? n - at : segment;
        const datagram: u8[] = [];
        for (let k: i32 = at; k < at + len; k++) {
          datagram.push(this.rx[k]);
        }
        this.c.datagrams.push(datagram);
        qcReceive(this.c, datagram);
      }
      reads++;
      n = udpRecvFrom(this.fd, this.rx, n32(0), n32(65536), this.from, this.meta);
    }
    this.absorb();
    return reads;
  }

  /** Files the frames of every 1-RTT packet not yet read. */
  absorb(): void {
    while (this.seen < toI32(this.c.appPayloads.length)) {
      const payload: u8[] = this.c.appPayloads[this.seen];
      this.seen = this.seen + 1;
      let at: i32 = 0;
      while (at < toI32(payload.length)) {
        const f: QuicFrame = this.frame;
        if (quicParseFrame(f, payload, at, toI32(payload.length)) !== n64(0) || f.end <= at) {
          break;
        }
        if (f.type === QUIC_FRAME_DATAGRAM && f.dataLength > 0) {
          const d: u8[] = [];
          for (let k: i32 = 1; k < f.dataLength; k++) {
            d.push(payload[f.dataStart + k]);
          }
          this.datagrams.push(d);
        } else if (f.type === QUIC_FRAME_STREAM && (f.streamId === n64(0) || f.streamId === n64(4))) {
          const into: u8[] = f.streamId === n64(0) ? this.connect : this.second;
          if (f.offset === toI64(toI32(into.length))) {
            for (let k: i32 = 0; k < f.dataLength; k++) {
              into.push(payload[f.dataStart + k]);
            }
          }
        } else if (f.type === QUIC_FRAME_CONNECTION_CLOSE || f.type === QUIC_FRAME_CONNECTION_CLOSE_APP) {
          this.closeCode = f.errorCode;
          this.closeApp = f.type === QUIC_FRAME_CONNECTION_CLOSE_APP;
        }
        at = f.end;
      }
    }
  }

  /** Acknowledges what arrived since the last acknowledgement, so the relay's window stays open. */
  ackIfNew(): void {
    if (this.connected && this.closeCode < 0 && this.c.largestApp > this.acked) {
      const none: u8[] = [];
      this.packet(none);
    }
  }

  /** The client's streams and SETTINGS, and an extended CONNECT for a WebTransport session on `path`, in one packet. */
  open(path: string): void {
    const payload: u8[] = [];
    const control: u8[] = h3Cat([h3Varint(H3_STREAM_CONTROL), wtSettingsFrame(wtClientSettingIds(), wtClientSettingValues())]);
    quicPushStream(payload, CLIENT_CONTROL, n64(0), control, n32(0), toI32(control.length), false);
    const encoder: u8[] = h3Varint(H3_STREAM_QPACK_ENCODER);
    quicPushStream(payload, CLIENT_ENCODER, n64(0), encoder, n32(0), n32(1), false);
    const decoder: u8[] = h3Varint(H3_STREAM_QPACK_DECODER);
    quicPushStream(payload, CLIENT_DECODER, n64(0), decoder, n32(0), n32(1), false);
    const head: u8[] = h3Frame(
      H3_FRAME_HEADERS,
      h3Section(
        this.enc,
        [":method", ":scheme", ":authority", ":path", ":protocol", "origin"],
        ["CONNECT", "https", "localhost", path, "webtransport", "https://localhost"]
      )
    );
    quicPushStream(payload, n64(0), n64(0), head, n32(0), toI32(head.length), false);
    this.connectSent = toI64(toI32(head.length));
    this.packet(payload);
  }

  /** Ends the client's half of the CONNECT stream: the session is over (draft-02 §5). */
  finConnect(): void {
    const payload: u8[] = [];
    const none: u8[] = [];
    quicPushStream(payload, n64(0), this.connectSent, none, n32(0), n32(0), true);
    this.packet(payload);
  }

  /** Closes the QUIC connection outright, CONNECTION_CLOSE with application code 0 and no reason, without a word to WebTransport. */
  quit(): void {
    this.packet([toU8(QUIC_FRAME_CONNECTION_CLOSE_APP), toU8(0), toU8(0)]);
  }

  /** HTTP datagrams of the session on stream 0, all in one packet: the quarter stream ID 0, then each payload. */
  datagram(payloads: u8[][]): void {
    const all: u8[] = [];
    for (const p of payloads) {
      const data: u8[] = h3Cat([h3Varint(n64(0)), p]);
      const size: i32 = quicDatagramSize(toI32(data.length));
      const frame: u8[] = new Array<u8>(size);
      quicPutDatagram(frame, n32(0), size, data, n32(0), toI32(data.length));
      for (const b of frame) {
        all.push(b);
      }
    }
    this.packet(all);
  }

  /** One datagram of the session. */
  send(payload: u8[]): void {
    this.datagram([payload]);
  }

  /** The `:status` the relay answered the CONNECT with, or "". */
  status(): string {
    return this.statusOf(this.connect);
  }

  /** The `:status` of the HEADERS frame `stream` starts with, or "". */
  statusOf(stream: u8[]): string {
    const n: i32 = toI32(stream.length);
    const size: i32 = h3ReadFrameHeader(this.header, stream, n32(0), n);
    if (size === 0 || this.header.type !== H3_FRAME_HEADERS || size + toI32(this.header.length) > n) {
      return "";
    }
    if (this.dec.decode(stream, size, toI32(this.header.length)) !== QPACK_OK) {
      return "";
    }
    for (let k: i32 = 0; k < this.dec.count; k++) {
      const name: u8[] = [];
      for (let j: i32 = this.dec.nameStart[k]; j < this.dec.nameStart[k] + this.dec.nameLength[k]; j++) {
        name.push(this.dec.bytes[j]);
      }
      if (textOf(name) === ":status") {
        const value: u8[] = [];
        for (let j: i32 = this.dec.valueStart[k]; j < this.dec.valueStart[k] + this.dec.valueLength[k]; j++) {
          value.push(this.dec.bytes[j]);
        }
        return textOf(value);
      }
    }
    return "";
  }

  /** Stream data on the client's bidirectional stream `id`, from offset 0, with the FIN when `fin`. */
  stream(id: i64, bytes: u8[], fin: boolean): void {
    const payload: u8[] = [];
    quicPushStream(payload, id, n64(0), bytes, n32(0), toI32(bytes.length), fin);
    this.packet(payload);
  }

  /** The type byte of each datagram the relay sent, in order, as hex pairs. */
  kinds(): string {
    const out: string[] = [];
    for (const d of this.datagrams) {
      out.push(toI32(d.length) > 0 ? `${d[0]}` : "-");
    }
    return out.join(" ");
  }

  /** The last datagram the relay sent, or an empty one. */
  last(): u8[] {
    const n: i32 = toI32(this.datagrams.length);
    const none: u8[] = [];
    return n > 0 ? this.datagrams[n - 1] : none;
  }
}

/** The relay, its game server and its clients, with the clocks they share. */
export class Rig {
  relay: Relay;
  echo: RigEcho;
  port: i32 = 0;
  clients: RigClient[];
  /** The relay's monotonic clock and wall clock, ms. */
  now: i64 = 1000;
  wall: i64 = 1700000000000;
  /** What the relay's steps kept in the arena while `measuring`, each counted in a chunk of its own. */
  kept: i64 = 0;
  measuring: boolean = false;

  constructor(config: RelayConfig, gro: boolean) {
    const fd: i32 = udpBind("127.0.0.1", n32(0), n32(2));
    this.port = netLocalPort(fd);
    const entropy: u8[] = new Array<u8>(QUIC_LISTENER_ENTROPY_SIZE);
    for (let k: i32 = 0; k < QUIC_LISTENER_ENTROPY_SIZE; k++) {
      entropy[k] = toU8(0x40 + k);
    }
    this.relay = rigRelay(config, fd, entropy);
    this.echo = new RigEcho(gro);
    this.clients = [];
  }

  /** One turn: the relay's step, signing with the test key, then the game server, then each client reads and acknowledges. Answers whether anything moved. */
  turn(): boolean {
    const key: Secret<u8[]> = secret(leafPrivate());
    // A 70,000-byte filler takes the rest of the current chunk, so the step starts a new one at 0
    // (`net_quic_stream`'s `NqMeter`, exact for a step that keeps under 64 KiB).
    const filler: u8[] = this.measuring ? new Array<u8>(70000) : [];
    const before: i64 = Arena.used();
    this.relay.step(this.now, this.wall, key, n32(0));
    const after: i64 = Arena.used();
    if (this.measuring && after !== before && toI32(filler.length) > 0) {
      this.kept = this.kept + after;
    }
    wipe(key);
    let moved: i32 = this.echo.serve();
    for (const c of this.clients) {
      moved = moved + c.read();
      c.ackIfNew();
    }
    return moved > 0;
  }

  /** Turns until nothing moves for a few turns in a row, at most `limit`. */
  settle(limit: i32): void {
    let quiet: i32 = 0;
    for (let k: i32 = 0; k < limit && quiet < 3; k++) {
      quiet = this.turn() ? 0 : quiet + 1;
    }
  }

  /** Moves both clocks on by `ms`, a step at a time no longer than `stride`, settling after each. */
  advance(ms: i64, stride: i64): void {
    let left: i64 = ms;
    while (left > 0) {
      const step: i64 = left < stride ? left : stride;
      this.now = this.now + step;
      this.wall = this.wall + step;
      left = left - step;
      this.settle(n32(50));
    }
  }

  /** A client numbered `index` from `host`, through its QUIC handshake with the relay. */
  connect(index: i32, host: string): RigClient {
    const c = new RigClient(index, host, this.port);
    this.clients.push(c);
    const hello: u8[] = c.hello();
    c.c.before = hello;
    const from: i32 = toI32(c.c.datagrams.length);
    c.transmit(qcInitial(c.c, qcCrypto(n64(0), hello), n32(1200)));
    this.settle(n32(50));
    if (qcReadFlight(c.c, from, n32(0))) {
      c.transmit(qcFinishedPacket(c.c));
      c.connected = true;
      this.settle(n32(50));
    }
    return c;
  }

  /** A client connected, its session asked for on `/cs` and answered, and its HELLO sent with a grant for the game server. */
  session(index: i32, host: string): RigClient {
    const c: RigClient = this.connect(index, host);
    c.open("/cs");
    this.settle(n32(50));
    c.send(rigHello(rigGrant("127.0.0.1", this.echo.port), RELAY_PROTOCOL_VERSION));
    this.settle(n32(50));
    return c;
  }
}
