// Every way the client can break the protocol, each reached on a fresh
// connection by one packet built to reach it alone: the connection closes
// with the transport error RFC 9000 names, and the CONNECTION_CLOSE it sends
// carries that code and the type of the frame at fault.
import { Suite } from "nish/testing";
import {
  QUIC_ERROR_CONNECTION_ID_LIMIT,
  QUIC_ERROR_CRYPTO,
  QUIC_ERROR_CRYPTO_BUFFER_EXCEEDED,
  QUIC_ERROR_FINAL_SIZE,
  QUIC_ERROR_FLOW_CONTROL,
  QUIC_ERROR_FRAME_ENCODING,
  QUIC_ERROR_PROTOCOL_VIOLATION,
  QUIC_ERROR_STREAM_LIMIT,
  QUIC_ERROR_STREAM_STATE,
  QUIC_ERROR_TRANSPORT_PARAMETER,
  QUIC_FRAME_CONNECTION_CLOSE,
  QUIC_FRAME_MAX_STREAM_DATA,
  QUIC_FRAME_PATH_RESPONSE,
  QUIC_FRAME_RETIRE_CONNECTION_ID,
  quicPushAck,
  quicPushNewConnectionId,
  quicPushPathData,
  quicPushStreamError,
  quicPushStreamValue,
  quicPushValue,
} from "nish/net/quic-frame";
import { QuicTransportParameters, quicEncodeTransportParameters } from "nish/net/quic-conn-params";
import { QUIC_STATE_CLOSING, QuicConnection } from "nish/net/quic";
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule";
import { cat } from "../net_tls_common/client";
import { fromHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { CLIENT_SCID, QcClient, qcConnect, qcCrypto, qcDrain, qcExchange, qcHandshake, qcHello, qcInitial, qcParams, qcReadFlight, qcSendHello, qcShort, qcShortTo } from "./client";
import { QcFound, qcConfig, qcConnected, qcDefaultConfig, qcFind, qcServer } from "./common";
import { qcStream } from "./data";

/** `code` and the frame type, as the close reports them. */
const closeOf = (f: QcFound): string => (f.found ? `${f.frame.errorCode} ${f.frame.frameType}` : "no close");

/**
 * Sends `payload` in a 1-RTT packet to a connection that completed its
 * handshake under `config`, and checks the connection closed with `error`
 * and said so in a CONNECTION_CLOSE naming `frameType`.
 */
const refuseIn = (t: Suite, name: string, config: QuicConnection, payload: u8[], error: i64, frameType: i64): void => {
  const c: QcClient = qcConnected(config, n64(65536));
  qcExchange(config, c, qcShort(c, payload));
  t.ok(`${name}: the connection closes`, config.state === QUIC_STATE_CLOSING && config.error === error);
  const n: i32 = toI32(c.appPayloads.length);
  const last: u8[][] = n > 0 ? [c.appPayloads[n - 1]] : [];
  t.eqStr(`${name}: and says so`, closeOf(qcFind(last, QUIC_FRAME_CONNECTION_CLOSE)), `${error} ${frameType}`);
};

/** `refuseIn` on a connection under the default configuration. */
const refuse = (t: Suite, name: string, payload: u8[], error: i64, frameType: i64): void =>
  refuseIn(t, name, qcServer(qcDefaultConfig()), payload, error, frameType);

/** The refusals of a connected connection. */
const connectedRefusals = (t: Suite): void => {
  const pv: i64 = QUIC_ERROR_PROTOCOL_VIOLATION;
  const none: u8[] = [];
  refuse(t, "a 1-RTT packet with no frames is PROTOCOL_VIOLATION (§12.4)", none, pv, n64(0));
  refuse(t, "an unknown frame type is FRAME_ENCODING_ERROR", fromHex("1f"), QUIC_ERROR_FRAME_ENCODING, n64(0));
  refuse(t, "a truncated frame is FRAME_ENCODING_ERROR", fromHex("020c"), QUIC_ERROR_FRAME_ENCODING, n64(2));
  refuse(t, "NEW_TOKEN to a server is PROTOCOL_VIOLATION (§19.7)", fromHex("0701aa"), pv, n64(7));
  refuse(t, "HANDSHAKE_DONE to a server is PROTOCOL_VIOLATION (§19.20)", fromHex("1e"), pv, n64(0x1e));
  const response: u8[] = [];
  quicPushPathData(response, QUIC_FRAME_PATH_RESPONSE, fromHex("0001020304050607"), n32(0));
  refuse(t, "a PATH_RESPONSE no challenge asked for is PROTOCOL_VIOLATION (§19.18)", response, pv, n64(0x1b));
  const ack: u8[] = [];
  quicPushAck(ack, [n64(0), n64(100)], n32(1), n64(0));
  refuse(t, "acknowledging a packet never sent is PROTOCOL_VIOLATION (§13.1)", ack, pv, n64(2));
  refuse(t, "CRYPTO at 1-RTT is the TLS alert unexpected_message, as CRYPTO_ERROR", qcCrypto(n64(0), fromHex("14000000")), QUIC_ERROR_CRYPTO + 10, n64(6));

  refuse(t, "STREAM on a stream the server would open is STREAM_STATE_ERROR", qcStream(n64(1), n64(0), "x", false), QUIC_ERROR_STREAM_STATE, n64(8));
  refuse(t, "STREAM on a unidirectional stream is STREAM_LIMIT_ERROR", qcStream(n64(2), n64(0), "x", false), QUIC_ERROR_STREAM_LIMIT, n64(8));
  refuse(t, "STREAM on a fifth bidirectional stream is STREAM_LIMIT_ERROR", qcStream(n64(16), n64(0), "x", false), QUIC_ERROR_STREAM_LIMIT, n64(8));
  const msd: u8[] = [];
  quicPushStreamValue(msd, QUIC_FRAME_MAX_STREAM_DATA, n64(3), n64(10));
  refuse(t, "MAX_STREAM_DATA on a server stream is STREAM_STATE_ERROR", msd, QUIC_ERROR_STREAM_STATE, n64(0x11));
  refuse(t, "data past a stream's credit is FLOW_CONTROL_ERROR (§4.1)", qcStream(n64(0), n64(16384), "x", false), QUIC_ERROR_FLOW_CONTROL, n64(8));
  refuseIn(
    t,
    "data past the connection's credit is FLOW_CONTROL_ERROR",
    qcServer(qcConfig(n64(20000), n64(16384), n64(4), n64(4))),
    cat([qcStream(n64(0), n64(16000), "x", false), qcStream(n64(4), n64(16000), "x", false)]),
    QUIC_ERROR_FLOW_CONTROL,
    n64(8)
  );
  refuse(
    t,
    "data past a stream's final size is FINAL_SIZE_ERROR (§4.5)",
    cat([qcStream(n64(0), n64(0), "abc", true), qcStream(n64(0), n64(0), "abcd", false)]),
    QUIC_ERROR_FINAL_SIZE,
    n64(8)
  );
  refuse(
    t,
    "a second FIN at another size is FINAL_SIZE_ERROR",
    cat([qcStream(n64(0), n64(0), "abc", true), qcStream(n64(0), n64(0), "ab", true)]),
    QUIC_ERROR_FINAL_SIZE,
    n64(8)
  );
  refuse(
    t,
    "a FIN below data already received is FINAL_SIZE_ERROR",
    cat([qcStream(n64(0), n64(5), "abcde", false), qcStream(n64(0), n64(0), "ab", true)]),
    QUIC_ERROR_FINAL_SIZE,
    n64(8)
  );
  const reset: u8[] = [];
  quicPushStreamError(reset, n64(0), n64(1), n64(2));
  refuse(t, "a RESET_STREAM final size below data received is FINAL_SIZE_ERROR", cat([qcStream(n64(0), n64(0), "abcde", false), reset]), QUIC_ERROR_FINAL_SIZE, n64(4));
  const resetFar: u8[] = [];
  quicPushStreamError(resetFar, n64(0), n64(1), n64(100000));
  refuse(t, "a RESET_STREAM final size past the credit is FLOW_CONTROL_ERROR", resetFar, QUIC_ERROR_FLOW_CONTROL, n64(4));

  const retireUnknown: u8[] = [];
  quicPushValue(retireUnknown, QUIC_FRAME_RETIRE_CONNECTION_ID, n64(9));
  refuse(t, "retiring an ID never issued is PROTOCOL_VIOLATION (§19.16)", retireUnknown, pv, n64(0x19));
  const retireOwn: u8[] = [];
  quicPushValue(retireOwn, QUIC_FRAME_RETIRE_CONNECTION_ID, n64(0));
  refuse(t, "retiring the ID the packet was sent to is PROTOCOL_VIOLATION", retireOwn, pv, n64(0x19));
  const token: u8[] = fromHex("000102030405060708090a0b0c0d0e0f");
  const twice: u8[] = [];
  quicPushNewConnectionId(twice, n64(1), n64(0), fromHex("d1"), token);
  quicPushNewConnectionId(twice, n64(1), n64(0), fromHex("d2"), token);
  refuse(t, "a sequence number reused with another ID is PROTOCOL_VIOLATION (§19.15)", twice, pv, n64(0x18));
  const many: u8[] = [];
  for (let k: i32 = 1; k <= 4; k++) {
    quicPushNewConnectionId(many, toI64(k), n64(0), [toU8(0xd0 + k)], token);
  }
  refuse(t, "more IDs than the server's limit of 4 is CONNECTION_ID_LIMIT_ERROR (§5.1.1)", many, QUIC_ERROR_CONNECTION_ID_LIMIT, n64(0x18));

  const conn: QuicConnection = qcServer(qcDefaultConfig());
  const c: QcClient = qcConnected(conn, n64(65536));
  qcExchange(conn, c, qcShortTo(c, c.serverScid, qcStream(n64(0), n64(0), "x", false), n32(0x08)));
  t.ok("a reserved bit set under a valid tag is PROTOCOL_VIOLATION (§17.3.1)", conn.state === QUIC_STATE_CLOSING && conn.error === pv);

  const zero: QuicConnection = qcServer(qcDefaultConfig());
  const empty: u8[] = [];
  const z = new QcClient(TLS_AES_128_GCM_SHA256, empty);
  t.ok(
    "a client with a zero-length connection ID completes a handshake",
    qcConnect(zero, z, qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(qcParams(empty, n64(65536)))))
  );
  const fromZero: u8[] = [];
  quicPushNewConnectionId(fromZero, n64(1), n64(0), fromHex("d1"), token);
  qcExchange(zero, z, qcShort(z, fromZero));
  t.ok("but its NEW_CONNECTION_ID is PROTOCOL_VIOLATION (§19.15)", zero.state === QUIC_STATE_CLOSING && zero.error === pv);

  const signed: QuicConnection = qcServer(qcDefaultConfig());
  qcConnected(signed, n64(65536));
  t.eqI64("signing when no signature is due fails TLS with internal_error", signed.sign(fromHex("3000")), QUIC_ERROR_CRYPTO + 80);
  t.eqI32("and closes the connection", signed.state, QUIC_STATE_CLOSING);
  t.eqI64("which then refuses to sign again", signed.sign(fromHex("3000")), QUIC_ERROR_CRYPTO + 80);
};

/** A connection that has read `hello` (with the client's transport parameters) in its first Initial. */
const started = (hello: u8[], c: QcClient): QuicConnection => {
  const conn: QuicConnection = qcServer(qcDefaultConfig());
  qcSendHello(conn, c, hello, n64(0), hello);
  return conn;
};

/** The refusals before the handshake is done, whose close goes in an Initial. */
const handshakeRefusals = (t: Suite): void => {
  const scid: u8[] = fromHex(CLIENT_SCID);
  const good: u8[] = quicEncodeTransportParameters(qcParams(scid, n64(65536)));

  const c1 = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const noAlpn: QuicConnection = started(qcHello([TLS_AES_128_GCM_SHA256], "", good), c1);
  t.eqI64("a ClientHello without ALPN is no_application_protocol, as CRYPTO_ERROR (RFC 9001 §8.1)", noAlpn.error, QUIC_ERROR_CRYPTO + 120);
  t.eqStr("closed in an Initial, naming CRYPTO", closeOf(qcFind(c1.longPayloads, QUIC_FRAME_CONNECTION_CLOSE)), `${QUIC_ERROR_CRYPTO + 120} 6`);

  const missing: QuicTransportParameters = qcParams(scid, n64(65536));
  missing.hasInitialScid = false;
  const c2 = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const noScid: QuicConnection = started(qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(missing)), c2);
  t.eqI64("parameters without initial_source_connection_id are TRANSPORT_PARAMETER_ERROR (§7.3)", noScid.error, QUIC_ERROR_TRANSPORT_PARAMETER);
  t.eqStr("closed in an Initial", closeOf(qcFind(c2.longPayloads, QUIC_FRAME_CONNECTION_CLOSE)), `${QUIC_ERROR_TRANSPORT_PARAMETER} 6`);

  const c3 = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const wrong: QuicConnection = started(
    qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(qcParams(fromHex("0102"), n64(65536)))),
    c3
  );
  t.eqI64("an initial_source_connection_id that is not the packet's SCID is PROTOCOL_VIOLATION (§7.3)", wrong.error, QUIC_ERROR_PROTOCOL_VIOLATION);

  const c4 = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const doubled: QuicConnection = started(qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", cat([good, fromHex("040100")])), c4);
  t.eqI64("malformed parameters are TRANSPORT_PARAMETER_ERROR", doubled.error, QUIC_ERROR_TRANSPORT_PARAMETER);

  const c5 = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const streamy: QuicConnection = qcServer(qcDefaultConfig());
  streamy.receive(qcInitial(c5, qcStream(n64(0), n64(0), "x", false), n32(1200)));
  t.eqI64("STREAM in an Initial is PROTOCOL_VIOLATION (§12.4)", streamy.error, QUIC_ERROR_PROTOCOL_VIOLATION);
  qcDrain(streamy, c5);
  t.eqStr("closed in an Initial, naming STREAM", closeOf(qcFind(c5.longPayloads, QUIC_FRAME_CONNECTION_CLOSE)), `${QUIC_ERROR_PROTOCOL_VIOLATION} 8`);

  const c6 = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const ahead: QuicConnection = qcServer(qcDefaultConfig());
  ahead.receive(qcInitial(c6, qcCrypto(n64(16384), fromHex("01")), n32(1200)));
  t.eqI64("CRYPTO data 16 KiB ahead is CRYPTO_BUFFER_EXCEEDED (§7.5)", ahead.error, QUIC_ERROR_CRYPTO_BUFFER_EXCEEDED);

  const c7 = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const cut: QuicConnection = qcServer(qcDefaultConfig());
  // PADDING first, so the truncated frame is the payload's last.
  cut.receive(qcInitial(c7, cat([new Array<u8>(1180), fromHex("060005")]), n32(0)));
  t.eqI64("a CRYPTO frame running past its packet is FRAME_ENCODING_ERROR", cut.error, QUIC_ERROR_FRAME_ENCODING);

  // A Handshake packet with a frame it may not carry: the close goes in both
  // the Initial and the Handshake space, since the client may have either key.
  const c8 = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const hello: u8[] = qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", good);
  const both: QuicConnection = qcServer(qcDefaultConfig());
  const from: i32 = qcSendHello(both, c8, hello, n64(0), hello);
  qcReadFlight(c8, from, n32(0));
  c8.longPayloads = [];
  qcExchange(both, c8, qcHandshake(c8, fromHex("1e")));
  t.ok("HANDSHAKE_DONE in a Handshake packet is PROTOCOL_VIOLATION", both.error === QUIC_ERROR_PROTOCOL_VIOLATION);
  t.eqI32("closed in an Initial and a Handshake packet", toI32(c8.longPayloads.length), n32(2));
  t.eqStr("each naming the frame", closeOf(qcFind(c8.longPayloads, QUIC_FRAME_CONNECTION_CLOSE)), `${QUIC_ERROR_PROTOCOL_VIOLATION} 30`);

  const c9 = new QcClient(TLS_AES_128_GCM_SHA256, scid);
  const unsigned: QuicConnection = qcServer(qcDefaultConfig());
  unsigned.receive(qcInitial(c9, qcCrypto(n64(0), hello), n32(1200)));
  t.ok("while TLS waits for the signature nothing is sent", unsigned.signatureInput() !== null && unsigned.takeDatagram() === null);
  const nothing: u8[] = [];
  t.eqI64("an empty signature fails TLS with internal_error", unsigned.sign(nothing), QUIC_ERROR_CRYPTO + 80);
};

/** Every refusal. */
export const quicConnRefusalChecks = (t: Suite): void => {
  connectedRefusals(t);
  handshakeRefusals(t);
};
