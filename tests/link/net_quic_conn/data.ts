// `nish/net/quic` after and around the handshake: the stream data path,
// acknowledgements, the connection-ID table in a live connection, path
// challenges, closing either way, the anti-amplification limit, a
// HelloRetryRequest and a ClientHello split across datagrams, and every
// packet the server must drop rather than act on.
import { Suite } from "nish/testing";
import {
  QUIC_PACKET_ZERO_RTT,
  quicLongHeader,
  quicRetryPacket,
  quicSealPacket,
} from "nish/net/quic-packet";
import {
  QUIC_ERROR_APPLICATION,
  QUIC_ERROR_INTERNAL,
  QUIC_ERROR_NO_ERROR,
  QUIC_FRAME_CONNECTION_CLOSE,
  QUIC_FRAME_CONNECTION_CLOSE_APP,
  QUIC_FRAME_DATA_BLOCKED,
  QUIC_FRAME_MAX_DATA,
  QUIC_FRAME_MAX_STREAM_DATA,
  QUIC_FRAME_MAX_STREAMS_BIDI,
  QUIC_FRAME_NEW_CONNECTION_ID,
  QUIC_FRAME_PATH_CHALLENGE,
  QUIC_FRAME_PATH_RESPONSE,
  QUIC_FRAME_PING,
  QUIC_FRAME_RETIRE_CONNECTION_ID,
  QUIC_FRAME_STREAM,
  QUIC_FRAME_STREAM_DATA_BLOCKED,
  QUIC_FRAME_STREAMS_BLOCKED_BIDI,
  quicPushAck,
  quicPushConnectionClose,
  quicPushNewConnectionId,
  quicPushPathData,
  quicPushStream,
  quicPushStreamError,
  quicPushStreamValue,
  quicPushTypeOnly,
  quicPushValue,
} from "nish/net/quic-frame";
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import {
  QUIC_CONN_ENTROPY_SIZE,
  QUIC_STATE_CLOSING,
  QUIC_STATE_CONNECTED,
  QUIC_STATE_DRAINING,
  QUIC_STATE_HANDSHAKE,
  QUIC_STATE_WAIT_INITIAL,
  QuicConnection,
  QuicServerConfig,
  QuicStreamData,
} from "nish/net/quic";
import {
  QUIC_STREAM_ERR_FINISHED,
  QUIC_STREAM_ERR_FLOW,
  QUIC_STREAM_ERR_STATE,
  QUIC_STREAM_ERR_UNKNOWN,
  QUIC_STREAM_OK,
} from "nish/net/quic-stream";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { TLS_SIGNATURE_ECDSA_SECP256R1_SHA256 } from "nish/net/tls/codec";
import { cat, transcriptHash } from "../net_tls_common/client";
import { leafCertificate } from "../net_tls_common/server";
import { bytesOf, fromHex, textOf, toHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { fixedEntropy, resetKey, tokenKey } from "../net_quic_conn_replay/server";
import {
  CLIENT_ODCID,
  CLIENT_SCID,
  QcClient,
  qcCrypto,
  qcDrain,
  qcExchange,
  qcFinishedPacket,
  qcHandshake,
  qcHello,
  qcHelloWithoutShare,
  qcInitial,
  qcParams,
  qcReadFlight,
  qcSendHello,
  qcShort,
  qcShortTo,
  QC_T0,
} from "./client";
import { QcFound, qcConfig, qcConnected, qcData, qcDefaultConfig, qcFind, qcFoundCid, qcFrameTypes, qcServer } from "./common";

/** A STREAM frame of `text` on `id` at `offset`. */
export const qcStream = (id: i64, offset: i64, text: string, fin: boolean): u8[] => {
  const out: u8[] = [];
  const data: u8[] = bytesOf(text);
  quicPushStream(out, id, offset, data, n32(0), toI32(data.length), fin);
  return out;
};

/** The text of every run of stream data the server has for the application, joined, with ` <fin>` after a FIN. */
export const qcReadAll = (conn: QuicConnection): string => {
  const parts: string[] = [];
  let data: QuicStreamData | null = conn.readStream();
  while (data !== null) {
    parts.push(`${data.streamId}:${textOf(data.data)}${data.fin ? " <fin>" : ""}`);
    data = conn.readStream();
  }
  return parts.join(" | ");
};

/** The last 1-RTT payload the server sent, or an empty one. */
const lastApp = (c: QcClient): u8[] => {
  const n: i32 = toI32(c.appPayloads.length);
  if (n > 0) {
    return c.appPayloads[n - 1];
  }
  const none: u8[] = [];
  return none;
};

/** The stream echo, both orders of arrival, and what writeStream refuses. */
const streamChecks = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = qcConnected(conn, n64(65536));
  t.eqI32("before any data the server's application reads nothing", conn.readStream() === null ? n32(0) : n32(1), n32(0));
  qcExchange(conn, c, qcShort(c, qcStream(n64(0), n64(0), "ping", true)));
  const data: QuicStreamData | null = conn.readStream();
  t.ok("the client's stream data reaches the application", data !== null && data.streamId === n64(0) && textOf(data.data) === "ping" && data.fin);
  t.ok("once", conn.readStream() === null);
  t.eqStr("the server acknowledges the packet", qcFrameTypes(lastApp(c)), "2");
  t.eqI32("writeStream echoes it back with the FIN", conn.writeStream(n64(0), bytesOf("ping"), true), QUIC_STREAM_OK);
  qcDrain(conn, c);
  const echo: QcFound = qcFind([lastApp(c)], QUIC_FRAME_STREAM);
  t.ok("as one STREAM frame on stream 0, offset 0, with FIN", echo.found && echo.frame.streamId === n64(0) && echo.frame.offset === n64(0) && echo.frame.fin);
  t.eqStr("carrying the bytes", textOf(qcData(echo)), "ping");
  t.eqI32("a second write after the FIN is refused", conn.writeStream(n64(0), bytesOf("x"), false), QUIC_STREAM_ERR_FINISHED);
  t.eqI32("a write to a stream the client never opened is refused", conn.writeStream(n64(4), bytesOf("x"), false), QUIC_STREAM_ERR_UNKNOWN);

  qcExchange(conn, c, qcShort(c, qcStream(n64(4), n64(3), "lo", false)));
  t.eqStr("data that arrives ahead of its stream waits", qcReadAll(conn), "");
  qcExchange(conn, c, qcShort(c, qcStream(n64(4), n64(0), "hel", false)));
  t.eqStr("and goes out with what fills the gap before it", qcReadAll(conn), "4:hello");
  qcExchange(conn, c, qcShort(c, qcStream(n64(4), n64(2), "llo world", true)));
  t.eqStr("overlapping data adds only what is new, then the FIN", qcReadAll(conn), "4: world <fin>");
  qcExchange(conn, c, qcShort(c, qcStream(n64(4), n64(0), "hello world", true)));
  t.eqStr("a stream that has ended delivers nothing more", qcReadAll(conn), "");
  qcExchange(conn, c, qcShort(c, qcStream(n64(8), n64(0), "", true)));
  t.eqStr("an empty frame with FIN ends a stream with no data", qcReadAll(conn), "8: <fin>");

  // Two frames in one packet, then the same packet again: one delivery.
  const twice: u8[] = qcShort(c, cat([qcStream(n64(12), n64(0), "a", false), qcStream(n64(12), n64(1), "b", false)]));
  const dropped: i32 = conn.dropped;
  qcExchange(conn, c, twice);
  qcExchange(conn, c, twice);
  t.eqStr("a duplicated packet delivers its data once", qcReadAll(conn), "12:ab");
  t.eqI32("and is counted as dropped", conn.dropped - dropped, n32(1));

  const early: QuicConnection = qcServer(qcDefaultConfig());
  t.eqI32("writeStream before the handshake is refused", early.writeStream(n64(0), bytesOf("x"), false), QUIC_STREAM_ERR_STATE);
};

/** Credit the client gives the server, and frames the server reads and does nothing with. */
const creditChecks = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = qcConnected(conn, n64(4));
  qcExchange(conn, c, qcShort(c, qcStream(n64(0), n64(0), "abcdef", false)));
  qcReadAll(conn);
  t.eqI32("a write past the credit the client gave the stream is refused", conn.writeStream(n64(0), bytesOf("abcdef"), false), QUIC_STREAM_ERR_FLOW);
  t.eqI32("one within it is queued", conn.writeStream(n64(0), bytesOf("abcd"), false), QUIC_STREAM_OK);
  t.eqI32("and the next byte is past it", conn.writeStream(n64(0), bytesOf("e"), false), QUIC_STREAM_ERR_FLOW);
  const more: u8[] = [];
  quicPushStreamValue(more, QUIC_FRAME_MAX_STREAM_DATA, n64(0), n64(100));
  qcExchange(conn, c, qcShort(c, more));
  t.eqI32("MAX_STREAM_DATA raises it", conn.writeStream(n64(0), bytesOf("ef"), true), QUIC_STREAM_OK);
  const stream: QcFound = qcFind([lastApp(c)], QUIC_FRAME_STREAM);
  t.ok("and the queued bytes went out at offset 0 with the next ACK", stream.found && textOf(qcData(stream)) === "abcd");
  qcDrain(conn, c);
  const rest: QcFound = qcFind([lastApp(c)], QUIC_FRAME_STREAM);
  t.ok("the rest follows at offset 4 with the FIN", rest.found && rest.frame.offset === n64(4) && rest.frame.fin && textOf(qcData(rest)) === "ef");

  const maxData: u8[] = [];
  quicPushValue(maxData, QUIC_FRAME_MAX_DATA, n64(2000000));
  qcExchange(conn, c, qcShort(c, maxData));
  t.eqI64("MAX_DATA raises the connection's credit", conn.streams.sendMaxData, n64(2000000));
  const lower: u8[] = [];
  quicPushValue(lower, QUIC_FRAME_MAX_DATA, n64(5));
  qcExchange(conn, c, qcShort(c, lower));
  t.eqI64("and a smaller one does not lower it", conn.streams.sendMaxData, n64(2000000));

  const quiet: u8[] = [];
  quicPushTypeOnly(quiet, QUIC_FRAME_PING);
  quicPushValue(quiet, QUIC_FRAME_DATA_BLOCKED, n64(1));
  quicPushStreamValue(quiet, QUIC_FRAME_STREAM_DATA_BLOCKED, n64(0), n64(1));
  quicPushValue(quiet, QUIC_FRAME_MAX_STREAMS_BIDI, n64(9));
  quicPushValue(quiet, QUIC_FRAME_STREAMS_BLOCKED_BIDI, n64(1));
  qcExchange(conn, c, qcShort(c, quiet));
  t.eqI32("PING and the blocked and stream-count frames leave the connection as it was", conn.state, QUIC_STATE_CONNECTED);
  t.eqStr("and are acknowledged", qcFrameTypes(lastApp(c)), "2");

  const stop: u8[] = [];
  quicPushStreamError(stop, n64(8), n64(5), n64(-1));
  qcExchange(conn, c, qcShort(c, cat([qcStream(n64(8), n64(0), "z", false), stop])));
  qcReadAll(conn);
  t.eqI32("STOP_SENDING ends the server's side of a stream", conn.writeStream(n64(8), bytesOf("z"), false), QUIC_STREAM_ERR_FINISHED);

  const conn2: QuicConnection = qcServer(qcDefaultConfig());
  const c2: QcClient = qcConnected(conn2, n64(4));
  const reset: u8[] = [];
  quicPushStreamError(reset, n64(0), n64(5), n64(5));
  qcExchange(conn2, c2, qcShort(c2, reset));
  qcExchange(conn2, c2, qcShort(c2, qcStream(n64(0), n64(0), "abcde", false)));
  t.eqStr("after RESET_STREAM the stream's data is dropped", qcReadAll(conn2), "");
  t.eqI32("and the connection carries on", conn2.state, QUIC_STATE_CONNECTED);
};

/** The connection-ID table, path challenges and acknowledgements in a live connection. */
const idChecks = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = qcConnected(conn, n64(65536));
  const first: QcFound = qcFind(c.appPayloads, QUIC_FRAME_NEW_CONNECTION_ID);
  const seq1: u8[] = qcFoundCid(first);
  const retire: u8[] = [];
  quicPushValue(retire, QUIC_FRAME_RETIRE_CONNECTION_ID, n64(1));
  qcExchange(conn, c, qcShort(c, retire));
  t.ok("RETIRE_CONNECTION_ID retires the server's ID", !conn.ownsConnectionId(seq1));
  const replacement: QcFound = qcFind([lastApp(c)], QUIC_FRAME_NEW_CONNECTION_ID);
  t.ok("and the server issues a replacement, sequence 4", replacement.found && replacement.frame.value === n64(4));
  t.eqI32("so the client still holds four", conn.cids.activeLocal(), n32(4));
  qcExchange(conn, c, qcShortTo(c, qcFoundCid(replacement), retire, n32(0)));
  t.eqI32("a packet sent to the new ID is the connection's (retiring 1 twice is fine)", conn.state, QUIC_STATE_CONNECTED);

  const newId: u8[] = [];
  const cid: u8[] = fromHex("d1d2d3d4d5d6d7d8");
  quicPushNewConnectionId(newId, n64(1), n64(1), cid, fromHex("000102030405060708090a0b0c0d0e0f"));
  qcExchange(conn, c, qcShort(c, newId));
  t.eqStr("NEW_CONNECTION_ID with Retire Prior To 1 makes the server retire the client's first ID", qcFrameTypes(lastApp(c)), "2 25");
  const retired: QcFound = qcFind([lastApp(c)], QUIC_FRAME_RETIRE_CONNECTION_ID);
  t.eqI64("sequence 0", retired.frame.value, n64(0));
  const sent: u8[] = c.datagrams[toI32(c.datagrams.length) - 1];
  const dcid: u8[] = [];
  for (let k: i32 = 1; k < 9 && k < toI32(sent.length); k++) {
    dcid.push(sent[k]);
  }
  t.eqStr("and send to the new one", toHex(dcid), "d1d2d3d4d5d6d7d8");

  const challenge: u8[] = [];
  const pathData: u8[] = fromHex("0123456789abcdef");
  quicPushPathData(challenge, QUIC_FRAME_PATH_CHALLENGE, pathData, n32(0));
  qcExchange(conn, c, qcShort(c, challenge));
  const response: QcFound = qcFind([lastApp(c)], QUIC_FRAME_PATH_RESPONSE);
  t.ok("PATH_CHALLENGE is answered with PATH_RESPONSE", response.found);
  t.eqStr("carrying the same eight bytes", toHex(qcData(response)), "0123456789abcdef");
  const burst: u8[] = [];
  for (let k: i32 = 0; k < 6; k++) {
    quicPushPathData(burst, QUIC_FRAME_PATH_CHALLENGE, pathData, n32(0));
  }
  qcExchange(conn, c, qcShort(c, burst));
  t.ok("a burst of challenges is answered without growing a queue", conn.state === QUIC_STATE_CONNECTED && conn.pathCount === 0);

  const ack: u8[] = [];
  quicPushAck(ack, [n64(0), n64(1)], n32(1), n64(0));
  qcExchange(conn, c, qcShort(c, ack));
  t.eqI64("an ACK from the client moves the space's largest acknowledged", conn.application.largestAcked, n64(1));
  t.eqStr("and, eliciting nothing, is not acknowledged", toHex(conn.takeDatagram(QC_T0)), "null");
  const older: u8[] = [];
  quicPushAck(older, [n64(0), n64(0)], n32(1), n64(0));
  qcExchange(conn, c, qcShort(c, older));
  t.eqI64("an older ACK does not move it back", conn.application.largestAcked, n64(1));
};

/** Closing the connection, from either side, and releasing it. */
const closeChecks = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = qcConnected(conn, n64(65536));
  conn.close(n64(7));
  t.eqI32("close() puts the connection in the closing state", conn.state, QUIC_STATE_CLOSING);
  t.eqI32("the next datagram is the close", qcDrain(conn, c), n32(1));
  const close: QcFound = qcFind([lastApp(c)], QUIC_FRAME_CONNECTION_CLOSE_APP);
  t.ok("an application CONNECTION_CLOSE (0x1d) with code 7, in a 1-RTT packet", close.found && close.frame.errorCode === n64(7));
  t.ok("then nothing", conn.takeDatagram(QC_T0) === null);
  t.eqI64("and every datagram is ignored, answering the code", conn.receive(qcShort(c, qcStream(n64(0), n64(0), "x", false)), QC_T0), n64(7));
  conn.close(n64(8));
  t.eqI64("closing twice changes nothing", conn.error, n64(7));

  const early: QuicConnection = qcServer(qcDefaultConfig());
  const scid: u8[] = fromHex(CLIENT_SCID);
  const e = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const hello: u8[] = qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(qcParams(scid, n64(65536))));
  early.receive(qcInitial(e, qcCrypto(n64(0), hello), n32(1200)), QC_T0);
  t.eqI32("a connection mid-handshake", early.state, QUIC_STATE_HANDSHAKE);
  early.close(n64(9));
  t.eqI32("closed by the application sends one datagram", qcDrain(early, e), n32(1));
  const inInitial: QcFound = qcFind(e.longPayloads, QUIC_FRAME_CONNECTION_CLOSE);
  t.ok(
    "an Initial cannot carry 0x1d, so it carries the transport close APPLICATION_ERROR",
    inInitial.found && inInitial.frame.errorCode === QUIC_ERROR_APPLICATION && inInitial.frame.frameType === n64(0)
  );

  const drained: QuicConnection = qcServer(qcDefaultConfig());
  const d: QcClient = qcConnected(drained, n64(65536));
  const peerClose: u8[] = [];
  quicPushConnectionClose(peerClose, false, QUIC_ERROR_NO_ERROR, n64(0), bytesOf("bye"));
  t.eqI32("a CONNECTION_CLOSE from the client", qcExchange(drained, d, qcShort(d, peerClose)), n32(0));
  t.eqI32("puts the connection in the draining state, sending nothing", drained.state, QUIC_STATE_DRAINING);
  t.eqI64("with the client's code", drained.error, QUIC_ERROR_NO_ERROR);
  const appClosed: QuicConnection = qcServer(qcDefaultConfig());
  const a: QcClient = qcConnected(appClosed, n64(65536));
  const appClose: u8[] = [];
  quicPushConnectionClose(appClose, true, n64(42), n64(0), bytesOf(""));
  qcExchange(appClosed, a, qcShort(a, appClose));
  t.ok("an application close from the client drains too, keeping its code", appClosed.state === QUIC_STATE_DRAINING && appClosed.error === n64(42) && appClosed.errorIsApplication);
  appClosed.close(n64(1));
  t.eqI64("and the application cannot close it again", appClosed.error, n64(42));

  const released: QuicConnection = qcServer(qcDefaultConfig());
  const rc: QcClient = qcConnected(released, n64(65536));
  const token: u8[] = fromHex("000102030405060708090a0b0c0d0e0f");
  const fromClient: u8[] = [];
  quicPushNewConnectionId(fromClient, n64(1), n64(0), fromHex("d1d2"), token);
  qcExchange(released, rc, qcShort(rc, fromClient));
  const keys = released.application.writeKeys;
  const key: u8[] = keys === null ? fromHex("ff") : keys.key;
  const tlsAtRelease = released.tls;
  const finished: u8[] = tlsAtRelease === null ? fromHex("ff") : tlsAtRelease.expectedClientFinished;
  const params: u8[] = tlsAtRelease === null ? fromHex("ff") : tlsAtRelease.config.quicTransportParameters;
  const tokens: u8[][] = [];
  for (const entry of released.cids.local) {
    tokens.push(entry.resetToken);
  }
  for (const entry of released.cids.peer) {
    tokens.push(entry.resetToken);
  }
  released.release();
  t.ok("release() discards the 1-RTT keys", released.application.discarded && released.application.writeKeys === null);
  let zero: boolean = toI32(key.length) > 0;
  for (const b of key) {
    zero = zero && toI32(b) === 0;
  }
  t.ok("wiping the key bytes", zero);
  // Four slots for the server's IDs and four for the client's, the limit it was given.
  let tokensZero: boolean = toI32(tokens.length) === 8;
  for (const tk of tokens) {
    for (const b of tk) {
      tokensZero = tokensZero && toI32(b) === 0;
    }
  }
  t.ok("and every slot's stateless reset token: the four the server issued and the client's one", tokensZero);
  let tlsZero: boolean = toI32(finished.length) === 32 && toI32(params.length) > 0;
  for (const b of finished) {
    tlsZero = tlsZero && toI32(b) === 0;
  }
  for (const b of params) {
    tlsZero = tlsZero && toI32(b) === 0;
  }
  t.ok("and TLS's expected client Finished and the encoded transport parameters, which carry a token", tlsZero);
  t.ok("and the connection sends nothing more", released.state === QUIC_STATE_CLOSING && released.takeDatagram(QC_T0) === null);
};

/** The packets a server drops rather than act on. */
const dropChecks = (t: Suite): void => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const scid: u8[] = fromHex(CLIENT_SCID);
  const c = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const hello: u8[] = qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(qcParams(scid, n64(65536))));
  t.eqI64("a first Initial in a datagram under 1200 bytes", conn.receive(qcInitial(c, qcCrypto(n64(0), hello), n32(0)), QC_T0), n64(0));
  t.ok("is dropped, and the connection still waits", conn.dropped === 1 && conn.state === QUIC_STATE_WAIT_INITIAL);
  const garbage: u8[] = new Array<u8>(1200);
  conn.receive(garbage, QC_T0);
  t.ok("so is a datagram that does not parse", conn.dropped === 2 && conn.state === QUIC_STATE_WAIT_INITIAL);
  const forged: u8[] = qcInitial(c, qcCrypto(n64(0), hello), n32(1200));
  forged[1100] = toU8(toI32(forged[1100]) ^ 1);
  conn.receive(forged, QC_T0);
  t.ok("so is a first Initial that does not authenticate, leaving nothing behind", conn.dropped === 3 && conn.state === QUIC_STATE_WAIT_INITIAL && conn.tls === null);
  const short = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  short.odcid = fromHex("00010203040506");
  conn.receive(qcInitial(short, qcCrypto(n64(0), hello), n32(1200)), QC_T0);
  t.ok("so is one to a DCID under 8 bytes (RFC 9000 §7.2)", conn.dropped === 4 && conn.state === QUIC_STATE_WAIT_INITIAL);

  t.ok("a connection that has read nothing has nothing to send", conn.takeDatagram(QC_T0) === null);
  const shortFirst: u8[] = new Array<u8>(1200);
  shortFirst[0] = toU8(0x40);
  conn.receive(shortFirst, QC_T0);
  t.ok("a 1-RTT packet cannot start a connection", conn.dropped === 5 && conn.state === QUIC_STATE_WAIT_INITIAL);
  const retryFirst: u8[] | null = quicRetryPacket(scid, fromHex("4040404040404040"), fromHex("aa"), fromHex(CLIENT_ODCID), n32(0));
  if (retryFirst !== null) {
    conn.receive(cat([retryFirst, new Array<u8>(1200)]), QC_T0);
  }
  t.ok("nor can a Retry", conn.dropped === 6 && conn.state === QUIC_STATE_WAIT_INITIAL);
  const unstarted: QuicConnection = qcServer(qcDefaultConfig());
  unstarted.close(n64(3));
  t.ok("a connection closed before it started sends nothing", unstarted.state === QUIC_STATE_CLOSING && unstarted.takeDatagram(QC_T0) === null);

  const from: i32 = qcSendHello(conn, c, hello, n64(0), hello);
  t.ok("a good first Initial still starts the connection", conn.state === QUIC_STATE_HANDSHAKE && toI32(c.datagrams.length) - from === 1);
  const zeroRtt: u8[] | null = quicLongHeader(QUIC_PACKET_ZERO_RTT, c.serverScid, scid, [], n64(9), n32(4), n32(8));
  const keys = c.initialWrite;
  const dropped0: i32 = conn.dropped;
  if (zeroRtt !== null && keys !== null) {
    const packet: u8[] | null = quicSealPacket(keys, zeroRtt, n64(9), new Array<u8>(8));
    if (packet !== null) {
      conn.receive(packet, QC_T0);
    }
  }
  t.eqI32("a 0-RTT packet is dropped: there is no 0-RTT here", conn.dropped - dropped0, n32(1));
  const stranger = new QcClient(TLS_AES_128_GCM_SHA256, fromHex("eeeeeeeeeeeeeeee"));
  stranger.serverScid = c.serverScid;
  conn.receive(qcInitial(stranger, qcCrypto(n64(0), hello), n32(1200)), QC_T0);
  t.eqI32("an Initial from another SCID is dropped", conn.dropped - dropped0, n32(2));
  t.ok("1-RTT data is not processed before the handshake completes", qcReadFlight(c, from, n32(0)));
  conn.receive(qcShort(c, qcStream(n64(0), n64(0), "early", true)), QC_T0);
  t.ok("(dropped, RFC 9001 §5.7)", conn.dropped - dropped0 === 3 && conn.readStream() === null);
  // The Finished and the stream data in one datagram: the Handshake packet
  // completes the handshake, and the 1-RTT packet after it is then read.
  qcExchange(conn, c, cat([qcFinishedPacket(c), qcShort(c, qcStream(n64(0), n64(0), "late", true))]));
  t.eqStr("a 1-RTT packet coalesced after the Finished is read once the handshake completes", qcReadAll(conn), "0:late <fin>");
  conn.receive(qcShortTo(c, fromHex("0909090909090909"), qcStream(n64(4), n64(0), "x", true), n32(0)), QC_T0);
  t.ok("a 1-RTT packet to an ID the server never issued is dropped", conn.dropped - dropped0 === 4 && conn.readStream() === null);
  const resent: u8[] = qcInitial(c, qcCrypto(n64(0), hello), n32(1200));
  conn.receive(resent, QC_T0);
  t.ok("an Initial after the Initial keys are discarded is dropped", conn.dropped - dropped0 === 5);
};

/** The handshake's other shapes: a HelloRetryRequest, a ClientHello split across datagrams, a flight past the amplification limit. */
const shapeChecks = (t: Suite): void => {
  const scid: u8[] = fromHex(CLIENT_SCID);
  const params: u8[] = quicEncodeTransportParameters(qcParams(scid, n64(65536)));

  const retry: QuicConnection = qcServer(qcDefaultConfig());
  const r = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const hello1: u8[] = qcHelloWithoutShare([TLS_AES_128_GCM_SHA256], params);
  qcSendHello(retry, r, hello1, n64(0), hello1);
  const hrr: u8[] = cat([r.cryptoInitial]);
  t.ok("a ClientHello without an x25519 share gets a HelloRetryRequest in an Initial", toI32(hrr.length) > 0 && toI32(hrr[0]) === 2 && retry.state === QUIC_STATE_HANDSHAKE);
  t.ok("and no Handshake keys yet", retry.handshake.writeKeys === null);
  const hello2: u8[] = qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", params);
  const messageHash: u8[] = cat([[toU8(254), toU8(0), toU8(0), toU8(32)], transcriptHash(n32(32), hello1)]);
  const from: i32 = qcSendHello(retry, r, hello2, toI64(toI32(hello1.length)), cat([messageHash, hrr, hello2]));
  t.ok("the second ClientHello, continuing the CRYPTO stream, gets the flight", qcReadFlight(r, from, toI32(hrr.length)));
  qcExchange(retry, r, qcFinishedPacket(r));
  t.eqI32("and the handshake completes", retry.state, QUIC_STATE_CONNECTED);

  const hello: u8[] = qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", params);
  const half: i32 = toI32(hello.length) / 2;
  const front: u8[] = [];
  const back: u8[] = [];
  for (let k: i32 = 0; k < toI32(hello.length); k++) {
    if (k < half) {
      front.push(hello[k]);
    } else {
      back.push(hello[k]);
    }
  }
  const split: QuicConnection = qcServer(qcDefaultConfig());
  const s = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  s.before = hello;
  qcExchange(split, s, qcInitial(s, qcCrypto(toI64(half), back), n32(1200)));
  t.ok("the second half of a ClientHello, first, waits for the first", split.state === QUIC_STATE_HANDSHAKE && split.signatureInput() === null);
  // Any keys will do: the server cannot open a Handshake packet yet.
  const beforeKeys: i32 = split.dropped;
  s.handshakeWrite = s.initialWrite;
  split.receive(qcHandshake(s, fromHex("01")), QC_T0);
  s.handshakeWrite = null;
  s.handshakePn = 0;
  t.eqI32("a Handshake packet before the server has Handshake keys is dropped", split.dropped - beforeKeys, n32(1));
  t.eqI32("with nothing sent but an acknowledgement", toI32(s.datagrams.length), n32(1));
  const flight: i32 = toI32(s.datagrams.length);
  qcExchange(split, s, qcInitial(s, qcCrypto(n64(0), front), n32(1200)));
  t.ok("then the first half completes it, and the flight follows", qcReadFlight(s, flight, n32(0)));
  qcExchange(split, s, qcFinishedPacket(s));
  t.eqI32("and the handshake completes", split.state, QUIC_STATE_CONNECTED);

  // A chain with a 4000-byte second certificate makes a flight of four datagrams.
  const big: u8[] = new Array<u8>(4000);
  const chain: u8[][] = [leafCertificate(), big];
  const config: QuicServerConfig = {
    certificateChain: chain,
    alpn: ["nish-echo"],
    signatureScheme: TLS_SIGNATURE_ECDSA_SECP256R1_SHA256,
    maxData: n64(65536),
    maxStreamData: n64(16384),
    maxStreamsBidi: n64(4),
    maxStreamsUni: n64(0),
    localStreams: n64(0),
    maxDatagramFrameSize: n64(0),
    maxIdleTimeout: n64(0),
    activeConnectionIdLimit: n64(2),
    statelessResetKey: resetKey(),
    retryTokenKey: tokenKey(),
    retry: false,
    retryTokenLifetime: n64(10000),
  };
  const amp = new QuicConnection(config, fixedEntropy());
  const a = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const ampFrom: i32 = qcSendHello(amp, a, hello, n64(0), hello);
  t.eqI32("an unvalidated client's 1200 bytes buy three datagrams (RFC 9000 §8.1)", toI32(a.datagrams.length) - ampFrom, n32(3));
  t.eqI64("3600 bytes, three times what was received", amp.bytesSent, n64(3600));
  const ackOnly: u8[] = [];
  quicPushAck(ackOnly, [n64(0), n64(0)], n32(1), n64(0));
  qcExchange(amp, a, qcInitial(a, ackOnly, n32(1200)));
  t.eqStr("another 1200 bytes from the client release the rest", `${toI32(a.datagrams.length) - ampFrom} datagrams, ${amp.bytesSent} bytes, validated ${amp.addressValidated}`, "5 datagrams, 4867 bytes, validated false");
  t.ok("which the client accepts", qcReadFlight(a, ampFrom, n32(0)));
  qcExchange(amp, a, qcFinishedPacket(a));
  t.ok("and the handshake completes, validating the address", amp.state === QUIC_STATE_CONNECTED && amp.addressValidated);
  t.eqStr("then HANDSHAKE_DONE and the client's three new IDs", qcFrameTypes(lastApp(a)), "30 24 24 24");
};

/** The constructor's refusals. */
const constructorChecks = (t: Suite): void => {
  const short: u8[] = new Array<u8>(QUIC_CONN_ENTROPY_SIZE - 1);
  const bad = new QuicConnection(qcDefaultConfig(), short);
  t.ok("entropy of the wrong length leaves the connection closed with INTERNAL_ERROR", bad.state === QUIC_STATE_CLOSING && bad.error === QUIC_ERROR_INTERNAL);
  t.ok("sending nothing", bad.takeDatagram(QC_T0) === null);
  t.eqI64("and ignoring every datagram", bad.receive(new Array<u8>(1200), QC_T0), QUIC_ERROR_INTERNAL);
  t.ok("nor does it sign anything", bad.signatureInput() === null && bad.sign(fromHex("01")) === QUIC_ERROR_INTERNAL);
  const entropy: u8[] = fixedEntropy();
  qcServer(qcDefaultConfig());
  new QuicConnection(qcDefaultConfig(), entropy);
  let wiped: boolean = true;
  for (const b of entropy) {
    wiped = wiped && toI32(b) === 0;
  }
  t.ok("the caller's entropy is wiped once it is copied", wiped);
  const limits: QuicServerConfig[] = [
    qcConfig(n64(65536), n64(0), n64(4), n64(4)),
    qcConfig(n64(65536), n64(2000000), n64(4), n64(4)),
    qcConfig(n64(65536), n64(16384), n64(-1), n64(4)),
    qcConfig(n64(65536), n64(16384), n64(2000), n64(4)),
    qcConfig(n64(-1), n64(16384), n64(4), n64(4)),
    qcConfig(n64(65536), n64(16384), n64(4), n64(1)),
    qcConfig(n64(65536), n64(16384), n64(4), n64(9)),
  ];
  let refused: boolean = true;
  for (const config of limits) {
    const conn = new QuicConnection(config, fixedEntropy());
    refused = refused && conn.state === QUIC_STATE_CLOSING && conn.error === QUIC_ERROR_INTERNAL;
  }
  t.ok("limits outside what QuicServerConfig allows are refused the same way", refused);
  const idle: QuicServerConfig = qcConfig(n64(65536), n64(16384), n64(4), n64(4));
  idle.maxIdleTimeout = n64(-1);
  t.eqI64("so is a negative idle timeout", new QuicConnection(idle, fixedEntropy()).error, QUIC_ERROR_INTERNAL);
};

/** Every data-path check. */
export const quicConnDataChecks = (t: Suite): void => {
  streamChecks(t);
  creditChecks(t);
  idChecks(t);
  closeChecks(t);
  dropChecks(t);
  shapeChecks(t);
  constructorChecks(t);
};
