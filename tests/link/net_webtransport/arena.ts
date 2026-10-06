// Nothing allocated per datagram, per stream or per session. Every call the
// server makes — the QUIC connection's receive and send, and the WebTransport
// layer's `next`, `accept`, `sendDatagram`, `openStream` and `write` — is
// measured on its own with `Arena.used()`, as `net_http3/arena.ts` measures
// HTTP/3's; the client beside it allocates freely between the measurements.
// A warm session echoing datagrams and streams keeps nothing; session after
// session through one session slot keeps nothing; and connection after
// connection through one QUIC slot keeps nothing past its handshake, whose
// cost is the QUIC handshake's (TLS-3).
import { Secret, secret, wipe } from "nish:secret";
import { Suite } from "nish/testing";
import { quicPushAck, quicPushStream, quicPutDatagram, quicDatagramSize } from "nish/net/quic-frame";
import { QUIC_STATE_CONNECTED, QuicConnection } from "nish/net/quic";
import { tlsSignEcdsaP256 } from "nish/net/tls";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { H3_FRAME_DATA, H3_FRAME_WEBTRANSPORT_STREAM, H3_STREAM_CONTROL, H3_STREAM_QPACK_DECODER, H3_STREAM_QPACK_ENCODER, H3_STREAM_WEBTRANSPORT } from "nish/net/http3-frame";
import { H3_ERROR, H3_NEED_MORE, H3_ALPN, Http3Connection } from "nish/net/http3";
import {
  WT_CAPSULE_CLOSE,
  WT_CLOSED,
  WT_DATAGRAM,
  WT_SESSION,
  WT_STREAM,
  WT_STREAM_DATA,
  WT_STREAM_END,
  WebTransport,
} from "nish/net/webtransport";
import { QpackEncoder } from "nish/net/qpack";
import { fromHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { leafPrivate } from "../net_tls_common/server";
import { fixedEntropy } from "../net_quic_conn_replay/server";
import { CLIENT_SCID, QcClient, qcCrypto, qcFinishedPacket, qcHello, qcInitial, qcReadFlight, qcShort } from "../net_quic_conn/client";
import { NqMeter, nqMeteredDrain, nqMeteredReceive } from "../net_quic_stream/arena";
import { h3Cat, h3Frame, h3Pattern, h3Section, h3Varint } from "../net_http3/peer";
import {
  WT_CLIENT_CONTROL,
  WT_CLIENT_DECODER,
  WT_CLIENT_ENCODER,
  WtLimits,
  wtClientParams,
  wtClientSettingIds,
  wtClientSettingValues,
  wtClosePayload,
  wtConfig,
  wtH3Config,
  wtQuicConfig,
  wtSettingsFrame,
} from "./peer";

/** One server slot and its echo application's buffers, made once. */
class WtArenaServer {
  conn: QuicConnection;
  h3: Http3Connection;
  wt: WebTransport;
  /** A stream's bytes as they come, echoed from here at its end. */
  buf: u8[];
  fill: i32 = 0;
  datagrams: i32 = 0;
  streams: i32 = 0;
  sessions: i32 = 0;
  closes: i32 = 0;

  constructor(limits: WtLimits) {
    this.conn = new QuicConnection(wtQuicConfig(limits), fixedEntropy());
    this.h3 = new Http3Connection(wtH3Config(limits), this.conn);
    this.wt = new WebTransport(wtConfig(limits), this.h3);
    this.buf = new Array<u8>(4096);
  }
}

/** The server's application, measured as one call: every event read, sessions accepted, datagrams and streams echoed. */
const wtMeteredServe = (s: WtArenaServer, m: NqMeter): void => {
  const filler: u8[] = m.filler();
  const before: i64 = Arena.used();
  const wt: WebTransport = s.wt;
  let event: i32 = wt.next();
  while (event !== H3_NEED_MORE && event !== H3_ERROR) {
    if (event === WT_SESSION) {
      wt.accept(wt.sessionId);
      s.sessions = s.sessions + 1;
    } else if (event === WT_DATAGRAM) {
      if (wt.sendDatagram(wt.sessionId, wt.data, wt.dataStart, wt.dataLength) === 0) {
        s.datagrams = s.datagrams + 1;
      }
    } else if (event === WT_STREAM) {
      s.fill = 0;
    } else if (event === WT_STREAM_DATA) {
      for (let k: i32 = 0; k < wt.dataLength && s.fill < toI32(s.buf.length); k++) {
        s.buf[s.fill] = wt.data[wt.dataStart + k];
        s.fill = s.fill + 1;
      }
    } else if (event === WT_STREAM_END) {
      const out: i64 = (wt.stream & n64(2)) === n64(0) ? wt.stream : wt.openStream(wt.sessionId, false);
      if (out >= 0 && wt.write(out, s.buf, n32(0), s.fill, true) === s.fill) {
        s.streams = s.streams + 1;
      }
    } else if (event === WT_CLOSED) {
      s.closes = s.closes + 1;
    }
    event = wt.next();
  }
  m.add(before, filler);
};

/** A packet of `payload` to the server, served and drained, every server call measured; an ACK of all it sent goes first. */
const wtMeteredPacket = (s: WtArenaServer, c: QcClient, payload: u8[], m: NqMeter): void => {
  const all: u8[] = [];
  if (c.largestApp >= n64(0)) {
    quicPushAck(all, [n64(0), c.largestApp], n32(1), n64(0));
  }
  for (const b of payload) {
    all.push(b);
  }
  nqMeteredReceive(s.conn, qcShort(c, all), c.now, m);
  wtMeteredServe(s, m);
  nqMeteredDrain(s.conn, c, m);
};

/** `bytes` as a STREAM frame on `id` from `offset`, appended to `payload`. */
const wtStreamFrame = (payload: u8[], id: i64, offset: i64, bytes: u8[], fin: boolean): void => {
  quicPushStream(payload, id, offset, bytes, n32(0), toI32(bytes.length), fin);
};

/** A DATAGRAM frame carrying `data`, appended to `payload`. */
const wtDatagramFrame = (payload: u8[], data: u8[]): void => {
  const size: i32 = quicDatagramSize(toI32(data.length));
  const frame: u8[] = new Array<u8>(size);
  quicPutDatagram(frame, n32(0), size, data, n32(0), toI32(data.length));
  for (const b of frame) {
    payload.push(b);
  }
};

/** The client's control stream with `wtransport`'s SETTINGS, and its QPACK streams. */
const wtOpenClient = (s: WtArenaServer, c: QcClient, m: NqMeter): void => {
  const payload: u8[] = [];
  wtStreamFrame(payload, WT_CLIENT_CONTROL, n64(0), h3Cat([h3Varint(H3_STREAM_CONTROL), wtSettingsFrame(wtClientSettingIds(), wtClientSettingValues())]), false);
  wtStreamFrame(payload, WT_CLIENT_ENCODER, n64(0), h3Varint(H3_STREAM_QPACK_ENCODER), false);
  wtStreamFrame(payload, WT_CLIENT_DECODER, n64(0), h3Varint(H3_STREAM_QPACK_DECODER), false);
  wtMeteredPacket(s, c, payload, m);
};

/** The HEADERS frame of a session request. */
const wtConnectFrame = (enc: QpackEncoder): u8[] =>
  h3Frame(n64(1), h3Section(enc, [":method", ":scheme", ":authority", ":path", ":protocol"], ["CONNECT", "https", "localhost", "/arena", "webtransport"]));

/** The handshake of `c` with the server, every server call measured. Answers whether it completed. */
const wtMeteredHandshake = (s: WtArenaServer, c: QcClient, limits: WtLimits, m: NqMeter): boolean => {
  const hello: u8[] = qcHello([TLS_AES_128_GCM_SHA256], H3_ALPN, wtClientParams(limits));
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

/** One round on session 0: a datagram, a bidirectional stream and a unidirectional one, each whole. */
const wtRound = (s: WtArenaServer, c: QcClient, round: i32, m: NqMeter): void => {
  const payload: u8[] = [];
  wtDatagramFrame(payload, h3Cat([h3Varint(n64(0)), h3Pattern(n32(300))]));
  wtStreamFrame(payload, n64(4) + toI64(round) * n64(4), n64(0), h3Cat([h3Varint(H3_FRAME_WEBTRANSPORT_STREAM), h3Varint(n64(0)), h3Pattern(n32(200))]), true);
  wtStreamFrame(payload, n64(14) + toI64(round) * n64(4), n64(0), h3Cat([h3Varint(H3_STREAM_WEBTRANSPORT), h3Varint(n64(0)), h3Pattern(n32(100))]), true);
  wtMeteredPacket(s, c, payload, m);
};

/** Hundreds of datagrams and streams on one warm session keep nothing. */
const wtWarmSession = (t: Suite): void => {
  const limits = new WtLimits();
  limits.maxStreamsBidi = n64(64);
  limits.maxStreamsUni = n64(64);
  limits.localStreams = n64(64);
  // The test client never raises MAX_STREAMS, so it allows every echo stream up front.
  limits.clientUniStreams = n64(1000);
  limits.maxData = n64(16777216);
  const s = new WtArenaServer(limits);
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  const warm = new NqMeter(false);
  if (!t.ok("connected", wtMeteredHandshake(s, c, limits, warm))) {
    return;
  }
  wtOpenClient(s, c, warm);
  const enc = new QpackEncoder();
  const connect: u8[] = [];
  wtStreamFrame(connect, n64(0), n64(0), wtConnectFrame(enc), false);
  wtMeteredPacket(s, c, connect, warm);
  for (let r: i32 = 0; r < 20; r++) {
    wtRound(s, c, r, warm);
  }
  const m = new NqMeter(false);
  for (let r: i32 = 20; r < 220; r++) {
    wtRound(s, c, r, m);
  }
  t.eqI64("200 rounds on a warm session — a datagram and two streams in, each echoed, ACKs and credit — keep no arena memory", m.kept, n64(0));
  t.eqStr("and every datagram and stream was echoed", `${s.datagrams} ${s.streams}`, "220 440");
  t.eqI32("the session holds no stream once each is done", s.wt.streamCount[0], n32(0));
};

/** Session after session through one session slot keeps nothing. */
const wtSessionSlot = (t: Suite): void => {
  const limits = new WtLimits();
  limits.sessions = n32(1);
  const s = new WtArenaServer(limits);
  const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
  const warm = new NqMeter(false);
  if (!t.ok("connected", wtMeteredHandshake(s, c, limits, warm))) {
    return;
  }
  wtOpenClient(s, c, warm);
  const enc = new QpackEncoder();
  const connect: u8[] = wtConnectFrame(enc);
  const close: u8[] = h3Frame(H3_FRAME_DATA, h3Frame(WT_CAPSULE_CLOSE, wtClosePayload(n64(9), h3Pattern(n32(40)))));
  const m = new NqMeter(false);
  for (let k: i32 = 0; k < 120; k++) {
    const id: i64 = toI64(k) * n64(4);
    const open: u8[] = [];
    wtStreamFrame(open, id, n64(0), connect, false);
    wtMeteredPacket(s, c, open, k < 20 ? warm : m);
    // A datagram goes after the 200: one that overtakes its CONNECT is dropped (RFC 9297 §2.1.1).
    const datagram: u8[] = [];
    wtDatagramFrame(datagram, h3Cat([h3Varint(id >> n64(2)), h3Pattern(n32(64))]));
    wtMeteredPacket(s, c, datagram, k < 20 ? warm : m);
    const end: u8[] = [];
    wtStreamFrame(end, id, toI64(toI32(connect.length)), close, true);
    wtMeteredPacket(s, c, end, k < 20 ? warm : m);
    const ack: u8[] = [];
    wtMeteredPacket(s, c, ack, k < 20 ? warm : m);
  }
  t.eqI64("100 sessions through one slot, after 20 to warm it — CONNECT, a 200, a datagram each way, a CLOSE with a reason, both FINs — keep no arena memory", m.kept, n64(0));
  t.eqStr("each was accepted, echoed its datagram and closed", `${s.sessions} ${s.datagrams} ${s.closes}`, "120 120 120");
  t.eqI32("and the slot is free", s.wt.freeCount, n32(1));
};

/** Connection after connection through one QUIC slot: the reset and everything after each handshake keep nothing. */
const wtConnectionSlot = (t: Suite): void => {
  const limits = new WtLimits();
  const s = new WtArenaServer(limits);
  let resets: i64 = 0;
  let after: i64 = 0;
  let connected: i32 = 0;
  const enc = new QpackEncoder();
  for (let k: i32 = 0; k < 5; k++) {
    if (k > 0) {
      const entropy: u8[] = fixedEntropy();
      const before: i64 = Arena.used();
      s.conn.reset(entropy);
      s.h3.restart();
      resets = resets + (Arena.used() - before);
    }
    const c = new QcClient(TLS_AES_128_GCM_SHA256, fromHex(CLIENT_SCID));
    const handshake = new NqMeter(true);
    if (wtMeteredHandshake(s, c, limits, handshake)) {
      connected++;
    }
    const rest = new NqMeter(false);
    wtOpenClient(s, c, rest);
    const connect: u8[] = [];
    wtStreamFrame(connect, n64(0), n64(0), wtConnectFrame(enc), false);
    wtMeteredPacket(s, c, connect, rest);
    for (let r: i32 = 0; r < 5; r++) {
      wtRound(s, c, r, rest);
    }
    const before: i64 = Arena.used();
    s.conn.close(n64(0x100));
    rest.kept = rest.kept + (Arena.used() - before);
    nqMeteredDrain(s.conn, c, rest);
    if (k > 0) {
      after = after + rest.kept;
    }
  }
  t.eqI32("five connections, one after another, through one slot", connected, n32(5));
  t.eqI32("each with its session, which the layer forgot at the restart", s.sessions, n32(5));
  t.eqI64("resetting the slot keeps no arena memory", resets, n64(0));
  t.eqI64("after its handshake a connection keeps none: its streams, SETTINGS, a session, datagrams, streams, a close", after, n64(0));
};

/** Every arena check. */
export const wtArenaChecks = (t: Suite): void => {
  wtWarmSession(t);
  wtSessionSlot(t);
  wtConnectionSlot(t);
};
