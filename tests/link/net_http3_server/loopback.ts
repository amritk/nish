// `nish/net/http3-server` across loopback: the client of
// `tests/link/net_http3/peer.ts` on a UDP socket of its own, and an
// `Http3Server` on another, in one loop. A GET, a POST echoed both ways, a
// response held back by the pacer, and a GOAWAY that lets the server close
// the connection and free the slot; a client whose handshake chose another
// ALPN; a client that finds no slot free; and connection after connection
// through one slot with the arena measured.
import { netAddress, netLocalPort, udpBind, udpRecvFrom, udpSendTo } from "nish:net";
import { Secret, secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { quicPushAck, quicPushStream } from "nish/net/quic-frame";
import { QUIC_LISTENER_ENTROPY_SIZE } from "nish/net/quic-listener";
import { QuicServerConfig } from "nish/net/quic";
import { H3_FRAME_DATA, H3_NO_ERROR, H3_STREAM_CONTROL, H3_STREAM_QPACK_DECODER, H3_STREAM_QPACK_ENCODER } from "nish/net/http3-frame";
import { H3_ALPN, H3_END, H3_ERROR, H3_NEED_MORE, Http3Config, Http3Connection } from "nish/net/http3";
import { Http3Server } from "nish/net/http3-server";
import { QpackEncoder } from "nish/net/qpack";
import { bytesOf, fromHex, textOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafPrivate } from "../net_tls_common/server";
import { CLIENT_SCID, QcClient, qcCrypto, qcFinishedPacket, qcInitial, qcReadFlight, qcReceive, qcShort } from "../net_quic_conn/client";
import { NqMeter } from "../net_quic_stream/arena";
import {
  CLIENT_CONTROL,
  CLIENT_DECODER,
  CLIENT_ENCODER,
  H3Limits,
  H3Peer,
  H3Response,
  h3Cat,
  h3ClientSettings,
  h3Frame,
  h3Hello,
  h3IsPattern,
  h3Pattern,
  h3QuicConfig,
  h3Section,
  h3Varint,
  h3WireConnect,
} from "../net_http3/peer";

/** The listener's entropy: 0x30, 0x31, … */
const listenerEntropy = (): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < QUIC_LISTENER_ENTROPY_SIZE; k++) {
    out.push(toU8(0x30 + k));
  }
  return out;
};

/** A server of `slots` slots under `quicConfig` on a loopback socket of its own, and its port. */
export class LoopServer {
  server: Http3Server;
  port: i32 = 0;

  constructor(quicConfig: QuicServerConfig, slots: i32, port: i32) {
    const fd: i32 = udpBind("127.0.0.1", port, n32(0));
    this.port = netLocalPort(fd);
    this.server = new Http3Server(quicConfig, new Http3Config(), fd, slots, listenerEntropy());
  }
}

/** Requests across loopback through the carrier, and a GOAWAY that ends the connection cleanly. */
const exchange = (t: Suite): void => {
  const limits = new H3Limits();
  const loop = new LoopServer(h3QuicConfig(limits), n32(4), n32(0));
  const p: H3Peer = h3WireConnect(loop.server, loop.port, limits);
  if (!t.ok("a handshake across loopback, through the listener into a slot", loop.server.busy() === n32(1) && p.conn.handshakeComplete)) {
    return;
  }
  p.open(n64(-1));
  p.get(n64(0), "/hello");
  p.settle();
  const r: H3Response = p.response(n64(0));
  t.eqStr("a GET: 200, its body, the FIN", `${r.status} ${textOf(r.body)} ${r.fin}`, "200 hello, h3 true");
  const body: u8[] = h3Pattern(n32(100000));
  p.send(n64(4), h3Cat([p.headers("POST", "/echo", ["content-length"], ["100000"]), h3Frame(H3_FRAME_DATA, body)]), true);
  p.settle();
  const echo: H3Response = p.response(n64(4));
  t.ok("a POST of 100,000 bytes echoed whole, in GSO flights the client reads back", toI32(echo.body.length) === n32(100000) && h3IsPattern(echo.body) && echo.fin);
  const none: string[] = [];
  p.send(n64(8), p.headers("GET", "/big/300000", none, none), true);
  p.settle();
  const big: H3Response = p.response(n64(8));
  t.ok("300,000 bytes the pacer lets out over time", toI32(big.body.length) === n32(300000) && h3IsPattern(big.body) && big.fin);
  t.eqI32("GOAWAY", p.h3.goaway(), n32(0));
  loop.server.touch(n32(0));
  p.settle();
  t.eqStr("with every request finished the server closes: H3_NO_ERROR", `${p.closeApp} 0x${p.closeCode}`, `true 0x${H3_NO_ERROR}`);
  t.eqI32("and frees the slot", loop.server.busy(), n32(0));
  t.eqI32("having accepted one connection", loop.server.accepted, n32(1));
};

/** A handshake that chose another protocol than h3 never reaches HTTP/3 (RFC 9114 §3.1). */
const alpn = (t: Suite): void => {
  const limits = new H3Limits();
  limits.alpn = "nish-echo";
  const config: QuicServerConfig = h3QuicConfig(limits);
  config.alpn = [H3_ALPN, "nish-echo"];
  const loop = new LoopServer(config, n32(2), n32(0));
  const p: H3Peer = h3WireConnect(loop.server, loop.port, limits);
  t.eqStr("a client that chose nish-echo is closed with CRYPTO_ERROR no_application_protocol", `${p.closeApp} ${p.closeCode}`, "false 376");
  t.eqI32("and its slot freed", loop.server.busy(), n32(0));
};

/** A server whose slots are all taken drops a new client's Initial, and counts it. */
const full = (t: Suite): void => {
  const limits = new H3Limits();
  const loop = new LoopServer(h3QuicConfig(limits), n32(1), n32(0));
  const first: H3Peer = h3WireConnect(loop.server, loop.port, limits);
  const second: H3Peer = h3WireConnect(loop.server, loop.port, limits);
  t.ok("the first takes the one slot", first.conn.handshakeComplete && loop.server.busy() === n32(1));
  t.ok("the second gets no answer, and is counted", toI32(second.c.datagrams.length) === n32(0) && loop.server.refused >= n32(1));
};

/** A client that only sends datagrams, for the arena check: no application of its own in the server's loop. */
class Lean {
  loop: LoopServer;
  c: QcClient;
  fd: i32 = -1;
  to: u8[];
  rx: u8[];
  from: u8[];
  meta: i32[];
  names: u8[][];
  values: u8[][];
  body: u8[];
  request: u8[];
  answered: i32 = 0;

  constructor(loop: LoopServer) {
    this.loop = loop;
    this.c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
    this.fd = udpBind("127.0.0.1", n32(0), n32(0));
    this.to = new Array<u8>(18);
    netAddress(this.to, "127.0.0.1", loop.port);
    this.rx = new Array<u8>(65536);
    this.from = new Array<u8>(18);
    this.meta = [n32(0), n32(0)];
    this.names = [bytesOf("content-type")];
    this.values = [bytesOf("application/octet-stream")];
    this.body = h3Pattern(n32(1000));
    const enc = new QpackEncoder();
    const head: u8[] = h3Section(enc, [":method", ":scheme", ":authority", ":path", "content-length"], ["POST", "https", "localhost", "/upload", "1000"]);
    this.request = h3Cat([h3Frame(n64(1), head), h3Frame(H3_FRAME_DATA, h3Pattern(n32(1000)))]);
  }
}

/**
 * The server's loop, each call measured on its own with a `fresh` meter
 * when `m` is one: receive, timers, every ready slot answered (each request
 * at its end, a 200 and 1,000 bytes), flush. Then the client reads what came
 * back, unmeasured. Answers whether anything moved.
 */
const leanRound = (l: Lean, m: NqMeter): boolean => {
  const server: Http3Server = l.loop.server;
  const key: Secret<u8[]> = secret(leafPrivate());
  let filler: u8[] = m.filler();
  let before: i64 = Arena.used();
  const got: i32 = server.receive(l.c.now, key);
  m.add(before, filler);
  wipe(key);
  filler = m.filler();
  before = Arena.used();
  server.tick(l.c.now);
  m.add(before, filler);
  filler = m.filler();
  before = Arena.used();
  let slot: i32 = server.ready();
  while (slot >= 0) {
    const h3: Http3Connection = server.connection(slot);
    let event: i32 = h3.next();
    while (event !== H3_NEED_MORE && event !== H3_ERROR) {
      if (event === H3_END) {
        h3.respond(h3.stream, n32(200), l.names, l.values, false);
        h3.writeData(h3.stream, l.body, n32(0), toI32(l.body.length), true);
        l.answered = l.answered + 1;
      }
      event = h3.next();
    }
    slot = server.ready();
  }
  m.add(before, filler);
  filler = m.filler();
  before = Arena.used();
  server.flush(l.c.now);
  m.add(before, filler);
  let read: i32 = 0;
  let n: i32 = udpRecvFrom(l.fd, l.rx, n32(0), n32(65536), l.from, l.meta);
  while (n >= 0) {
    const datagram: u8[] = [];
    for (let k: i32 = 0; k < n; k++) {
      datagram.push(l.rx[k]);
    }
    l.c.datagrams.push(datagram);
    qcReceive(l.c, datagram);
    read++;
    n = udpRecvFrom(l.fd, l.rx, n32(0), n32(65536), l.from, l.meta);
  }
  l.c.now = l.c.now + n64(1);
  return got > 0 || read > 0;
};

/** Sends `datagram` to the server and runs rounds until nothing moves. */
const leanSend = (l: Lean, datagram: u8[], m: NqMeter): void => {
  udpSendTo(l.fd, datagram, n32(0), toI32(datagram.length), l.to, n32(0), n32(0));
  for (let k: i32 = 0; k < 64 && leanRound(l, m); k++) {
    // until quiet
  }
};

/** A 1-RTT packet of `payload` from the client, with an ACK of everything it has first. */
const leanPacket = (l: Lean, payload: u8[], m: NqMeter): void => {
  const all: u8[] = [];
  if (l.c.largestApp >= n64(0)) {
    quicPushAck(all, [n64(0), l.c.largestApp], n32(1), n64(0));
  }
  for (const b of payload) {
    all.push(b);
  }
  leanSend(l, qcShort(l.c, all), m);
};

/**
 * Connection after connection through a server of one slot: from the second
 * on, everything the server does after the handshake — the client's
 * streams, five requests, a GOAWAY, the close, the slot freed — keeps no
 * arena memory, and the handshake, through the listener and into the slot,
 * keeps exactly as much each time.
 */
const reused = (t: Suite): void => {
  const limits = new H3Limits();
  const loop = new LoopServer(h3QuicConfig(limits), n32(1), n32(0));
  const handshakes: i64[] = [];
  let after: i64 = 0;
  let closed: i32 = 0;
  let answered: i32 = 0;
  for (let k: i32 = 0; k < 5; k++) {
    const l = new Lean(loop);
    l.c.now = toI64(k) * n64(100000);
    const handshake = new NqMeter(true);
    const hello: u8[] = h3Hello(limits);
    l.c.before = hello;
    leanSend(l, qcInitial(l.c, qcCrypto(n64(0), hello), n32(1200)), handshake);
    if (!qcReadFlight(l.c, n32(0), n32(0))) {
      t.fail("a handshake through the slot", "the client could not read the server's flight");
      return;
    }
    leanSend(l, qcFinishedPacket(l.c), handshake);
    handshakes.push(handshake.kept);
    const rest = new NqMeter(false);
    const control: u8[] = h3Cat([h3Varint(H3_STREAM_CONTROL), h3ClientSettings(n64(-1))]);
    const open: u8[] = [];
    quicPushStream(open, CLIENT_CONTROL, n64(0), control, n32(0), toI32(control.length), false);
    quicPushStream(open, CLIENT_ENCODER, n64(0), h3Varint(H3_STREAM_QPACK_ENCODER), n32(0), n32(1), false);
    quicPushStream(open, CLIENT_DECODER, n64(0), h3Varint(H3_STREAM_QPACK_DECODER), n32(0), n32(1), false);
    leanPacket(l, open, rest);
    for (let r: i32 = 0; r < 5; r++) {
      const payload: u8[] = [];
      quicPushStream(payload, toI64(r) * n64(4), n64(0), l.request, n32(0), toI32(l.request.length), true);
      leanPacket(l, payload, rest);
    }
    const filler: u8[] = rest.filler();
    const before: i64 = Arena.used();
    loop.server.connection(n32(0)).goaway();
    loop.server.touch(n32(0));
    rest.add(before, filler);
    const empty: u8[] = [];
    for (let r: i32 = 0; r < 4 && loop.server.busy() > 0; r++) {
      leanPacket(l, empty, rest);
    }
    if (loop.server.busy() === 0) {
      closed++;
    }
    answered = answered + l.answered;
    if (k > 0) {
      after = after + rest.kept;
    }
  }
  t.ok("five connections through one slot, each closed after its GOAWAY", closed === n32(5) && loop.server.accepted === n32(5));
  t.eqI32("each served its five requests", answered, n32(25));
  t.eqI64("from the second on, nothing after the handshake keeps arena memory: streams, requests, GOAWAY, close, release", after, n64(0));
  // The carrier draws real entropy for every connection, so a handshake's
  // messages differ by a byte here and there (an ECDSA signature's DER length,
  // a key share's), and so does what it keeps: a spread of a few dozen bytes,
  // not a growth.
  let low: i64 = handshakes[1];
  let high: i64 = handshakes[1];
  for (let k: i32 = 2; k < toI32(handshakes.length); k++) {
    low = handshakes[k] < low ? handshakes[k] : low;
    high = handshakes[k] > high ? handshakes[k] : high;
  }
  t.ok("and each handshake through the listener into the slot keeps as much as the last, give or take its random encodings: under 256 bytes apart", low > n64(0) && high - low < n64(256));
};

/** Every check of this file. */
export const loopbackChecks = (t: Suite): void => {
  exchange(t);
  alpn(t);
  full(t);
  reused(t);
};
