// Nothing allocated per request, and a slot reused connection after
// connection. Every call the server makes — the QUIC connection's receive and
// send, and the HTTP/3 connection's `next`, `respond` and `writeData` — is
// measured on its own with `Arena.used()`, the way `net_quic_stream`'s
// QUIC-3 checks measure them; the client beside it allocates freely, between
// the measurements. A warm connection serving request after request keeps
// nothing; connection after connection through one slot, the slot's reset
// keeps nothing and neither does anything a connection does after its
// handshake, whose cost is the QUIC handshake's (TLS-3) and the same every
// time.
import { Secret, secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";
import { quicPushAck, quicPushStream } from "nish/net/quic-frame";
import { QUIC_STATE_CONNECTED, QuicConnection } from "nish/net/quic";
import { tlsSignEcdsaP256 } from "nish/net/tls";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { H3_FRAME_DATA, H3_STREAM_CONTROL, H3_STREAM_QPACK_DECODER, H3_STREAM_QPACK_ENCODER } from "nish/net/http3-frame";
import { H3_END, H3_ERROR, H3_NEED_MORE, Http3Config, Http3Connection } from "nish/net/http3";
import { QpackEncoder } from "nish/net/qpack";
import { bytesOf, fromHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafPrivate } from "../net_tls_common/server";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { CLIENT_SCID, QcClient, qcCrypto, qcFinishedPacket, qcInitial, qcReadFlight, qcShort } from "../net_quic_conn/client";
import { NqMeter, nqMeteredDrain, nqMeteredReceive } from "../net_quic_stream/arena";
import { CLIENT_CONTROL, CLIENT_DECODER, CLIENT_ENCODER, H3Limits, h3Cat, h3ClientSettings, h3Frame, h3Hello, h3Pattern, h3QuicConfig, h3Section, h3Varint } from "./peer";

/** One server slot and what its application answers with, made once. */
class ArenaServer {
  conn: QuicConnection;
  h3: Http3Connection;
  names: u8[][];
  values: u8[][];
  body: u8[];
  /** The request every round sends: HEADERS of a POST with a content-length, and 1,000 bytes of DATA. */
  request: u8[];
  answered: i32 = 0;

  constructor(limits: H3Limits) {
    this.conn = new QuicConnection(h3QuicConfig(limits), fixedEntropy());
    this.h3 = new Http3Connection(new Http3Config(), this.conn);
    this.names = [bytesOf("content-type"), bytesOf("server")];
    this.values = [bytesOf("application/octet-stream"), bytesOf("nish")];
    this.body = h3Pattern(n32(1000));
    const enc = new QpackEncoder();
    const head: u8[] = h3Section(enc, [":method", ":scheme", ":authority", ":path", "content-length"], ["POST", "https", "localhost", "/upload", "1000"]);
    this.request = h3Cat([h3Frame(n64(1), head), h3Frame(H3_FRAME_DATA, h3Pattern(n32(1000)))]);
  }
}

/** The server's application, measured as one call: every event read, every request answered at its end with a 200, two fields and 1,000 bytes. */
const h3MeteredServe = (s: ArenaServer, m: NqMeter): void => {
  const filler: u8[] = m.filler();
  const before: i64 = Arena.used();
  let event: i32 = s.h3.next();
  while (event !== H3_NEED_MORE && event !== H3_ERROR) {
    if (event === H3_END) {
      const id: i64 = s.h3.stream;
      s.h3.respond(id, n32(200), s.names, s.values, false);
      s.h3.writeData(id, s.body, n32(0), toI32(s.body.length), true);
      s.answered = s.answered + 1;
    }
    event = s.h3.next();
  }
  m.add(before, filler);
};

/** A packet of `payload` to the server, served and drained, every server call measured; an ACK of all it sent goes first. */
const h3MeteredPacket = (s: ArenaServer, c: QcClient, payload: u8[], m: NqMeter): void => {
  const all: u8[] = [];
  if (c.largestApp >= n64(0)) {
    quicPushAck(all, [n64(0), c.largestApp], n32(1), n64(0));
  }
  for (const b of payload) {
    all.push(b);
  }
  nqMeteredReceive(s.conn, qcShort(c, all), c.now, m);
  h3MeteredServe(s, m);
  nqMeteredDrain(s.conn, c, m);
};

/** One request, whole, on stream `id`. */
const h3Round = (s: ArenaServer, c: QcClient, id: i64, m: NqMeter): void => {
  const payload: u8[] = [];
  quicPushStream(payload, id, n64(0), s.request, n32(0), toI32(s.request.length), true);
  h3MeteredPacket(s, c, payload, m);
};

/** The client's control stream with its SETTINGS, and its QPACK streams. */
const h3OpenClient = (s: ArenaServer, c: QcClient, m: NqMeter): void => {
  const control: u8[] = h3Cat([h3Varint(H3_STREAM_CONTROL), h3ClientSettings(n64(-1))]);
  const payload: u8[] = [];
  quicPushStream(payload, CLIENT_CONTROL, n64(0), control, n32(0), toI32(control.length), false);
  const encoder: u8[] = h3Varint(H3_STREAM_QPACK_ENCODER);
  quicPushStream(payload, CLIENT_ENCODER, n64(0), encoder, n32(0), n32(1), false);
  const decoder: u8[] = h3Varint(H3_STREAM_QPACK_DECODER);
  quicPushStream(payload, CLIENT_DECODER, n64(0), decoder, n32(0), n32(1), false);
  h3MeteredPacket(s, c, payload, m);
};

/** The handshake of `c` with the server, every server call measured. Answers whether it completed. */
const h3MeteredHandshake = (s: ArenaServer, c: QcClient, limits: H3Limits, m: NqMeter): boolean => {
  const hello: u8[] = h3Hello(limits);
  c.before = hello;
  const from: i32 = toI32(c.datagrams.length);
  nqMeteredReceive(s.conn, qcInitial(c, qcCrypto(n64(0), hello), n32(1200)), c.now, m);
  const fillInput: u8[] = m.filler();
  const beforeInput: i64 = Arena.used();
  const input: u8[] | null = s.conn.signatureInput();
  m.add(beforeInput, fillInput);
  if (input !== null) {
    const key: Secret<u8[]> = secret(leafPrivate());
    const signature: u8[] | null = tlsSignEcdsaP256(key, input);
    wipe(key);
    if (signature !== null) {
      const fillSign: u8[] = m.filler();
      const beforeSign: i64 = Arena.used();
      s.conn.sign(signature);
      m.add(beforeSign, fillSign);
    }
  }
  nqMeteredDrain(s.conn, c, m);
  if (!qcReadFlight(c, from, n32(0))) {
    return false;
  }
  nqMeteredReceive(s.conn, qcFinishedPacket(c), c.now, m);
  nqMeteredDrain(s.conn, c, m);
  return s.conn.state === QUIC_STATE_CONNECTED;
};

/** Hundreds of requests on one warm connection keep nothing. */
const h3PerRequest = (t: Suite): void => {
  const limits = new H3Limits();
  const s = new ArenaServer(limits);
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  const warm = new NqMeter(false);
  if (!t.ok("connected", h3MeteredHandshake(s, c, limits, warm))) {
    return;
  }
  h3OpenClient(s, c, warm);
  for (let k: i32 = 0; k < 20; k++) {
    h3Round(s, c, toI64(k) * n64(4), warm);
  }
  const m = new NqMeter(false);
  for (let k: i32 = 20; k < 220; k++) {
    h3Round(s, c, toI64(k) * n64(4), m);
  }
  t.eqI64("200 requests on a warm connection — HEADERS and DATA in, a 200 with a body out, ACKs and credit — keep no arena memory", m.kept, n64(0));
  t.eqI32("and every one was answered", s.answered, n32(220));
  t.eqI32("each finished both ways", s.h3.live, n32(0));
};

/**
 * Connection after connection through one slot: the reset keeps nothing,
 * and after its handshake a connection keeps nothing from the second on,
 * once the decoder's arrays and the field lists have grown to the section the
 * requests send. The handshake keeps exactly as much each time from the
 * second on, and that is the QUIC handshake's (TLS-3).
 */
const h3PerConnection = (t: Suite): void => {
  const limits = new H3Limits();
  const s = new ArenaServer(limits);
  const handshakes: i64[] = [];
  let resets: i64 = 0;
  let after: i64 = 0;
  let connected: i32 = 0;
  for (let k: i32 = 0; k < 6; k++) {
    if (k > 0) {
      const entropy: u8[] = fixedEntropy();
      const before: i64 = Arena.used();
      s.conn.reset(entropy);
      s.h3.restart();
      resets = resets + (Arena.used() - before);
    }
    const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
    const handshake = new NqMeter(true);
    if (h3MeteredHandshake(s, c, limits, handshake)) {
      connected++;
    }
    handshakes.push(handshake.kept);
    const rest = new NqMeter(false);
    h3OpenClient(s, c, rest);
    for (let r: i32 = 0; r < 10; r++) {
      h3Round(s, c, toI64(r) * n64(4), rest);
    }
    const before: i64 = Arena.used();
    s.conn.close(n64(0x100));
    rest.kept = rest.kept + (Arena.used() - before);
    nqMeteredDrain(s.conn, c, rest);
    if (k > 0) {
      after = after + rest.kept;
    }
  }
  t.eqI32("six connections, one after another, through one slot", connected, n32(6));
  t.eqI32("each served its ten requests", s.answered, n32(60));
  t.eqI64("resetting the slot for the next, QUIC and HTTP/3, keeps no arena memory", resets, n64(0));
  t.eqI64("after its handshake a connection keeps none: its streams, SETTINGS, ten requests, a close", after, n64(0));
  let same: boolean = handshakes[1] > n64(0);
  for (let k: i32 = 2; k < toI32(handshakes.length); k++) {
    same = same && handshakes[k] === handshakes[1];
  }
  t.ok("and from the second on, each handshake keeps exactly as much: nothing in the slot grows", same);
};

/** Every arena check. */
export const h3ArenaChecks = (t: Suite): void => {
  h3PerRequest(t);
  h3PerConnection(t);
};
