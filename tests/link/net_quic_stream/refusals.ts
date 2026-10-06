// The stream limits both ways, the ways a stream ends early, and every
// refusal: each refusal reached on a fresh connection by one packet built
// to reach it alone, closing with the transport error RFC 9000 names and a
// CONNECTION_CLOSE that carries it and the type of the frame at fault.
import { Suite } from "nish/testing";
import {
  QUIC_ERROR_FINAL_SIZE,
  QUIC_ERROR_FLOW_CONTROL,
  QUIC_ERROR_STREAM_LIMIT,
  QUIC_ERROR_STREAM_STATE,
  QUIC_FRAME_CONNECTION_CLOSE,
  QUIC_FRAME_MAX_STREAMS_UNI,
  QUIC_FRAME_MAX_STREAM_DATA,
  QUIC_FRAME_RESET_STREAM,
  QUIC_FRAME_STOP_SENDING,
  QUIC_FRAME_STREAMS_BLOCKED_UNI,
  QUIC_FRAME_STREAM_DATA_BLOCKED,
  quicPushStreamError,
  quicPushStreamValue,
  quicPushValue,
} from "nish/net/quic-frame";
import {
  QUIC_STREAM_ERR_DIRECTION,
  QUIC_STREAM_ERR_STATE,
  QUIC_STREAM_ERR_UNKNOWN,
  QUIC_RECV_RESET_RECVD,
  QUIC_SEND_RESET_RECVD,
  QUIC_SEND_RESET_SENT,
  QUIC_STREAM_ERR_FINISHED,
  QUIC_STREAM_ERR_LIMIT,
  QUIC_STREAM_ERR_STOPPED,
  QUIC_STREAM_OK,
} from "nish/net/quic-stream";
import { QUIC_STATE_CLOSING } from "nish/net/quic";
import { bytesOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { cat } from "../net_tls_common/client";
import { qcDrain } from "../net_quic_conn/client";
import { QcFound, qcFind } from "../net_quic_conn/common";
import { NqLimits, NqPair, NqRead, nqPair, nqReadAll, nqReceived, nqSend, nqSettle } from "./common";
import { qcStream } from "../net_quic_conn/data";

/** `code` and the frame type, as the close reports them. */
const closeOf = (f: QcFound): string => (f.found ? `${f.frame.errorCode} ${f.frame.frameType}` : "no close");

/** Sends `payload` to a fresh connection under `limits` and checks it closes with `error`, naming `frameType`. */
const refuseUnder = (t: Suite, name: string, limits: NqLimits, payload: u8[], error: i64, frameType: i64): void => {
  const p: NqPair = nqPair(limits);
  nqSend(p, payload);
  t.ok(`${name}: the connection closes`, p.conn.state === QUIC_STATE_CLOSING && p.conn.error === error);
  const n: i32 = toI32(p.c.appPayloads.length);
  const last: u8[][] = n > 0 ? [p.c.appPayloads[n - 1]] : [];
  t.eqStr(`${name}: and says so`, closeOf(qcFind(last, QUIC_FRAME_CONNECTION_CLOSE)), `${error} ${frameType}`);
};

/** `refuseUnder` the default limits. */
const refuse = (t: Suite, name: string, payload: u8[], error: i64, frameType: i64): void =>
  refuseUnder(t, name, new NqLimits(), payload, error, frameType);

/** A RESET_STREAM of `id` with `code` at `finalSize`, or STOP_SENDING with `finalSize` -1. */
const ending = (id: i64, code: i64, finalSize: i64): u8[] => {
  const out: u8[] = [];
  quicPushStreamError(out, id, code, finalSize);
  return out;
};

/** MAX_STREAM_DATA or STREAM_DATA_BLOCKED of `id` at `value`. */
const streamValue = (type: i32, id: i64, value: i64): u8[] => {
  const out: u8[] = [];
  quicPushStreamValue(out, type, id, value);
  return out;
};

/** Every refusal of a stream frame. */
const streamRefusals = (t: Suite): void => {
  const state: i64 = QUIC_ERROR_STREAM_STATE;
  const reset: i64 = toI64(QUIC_FRAME_RESET_STREAM);
  refuse(t, "STREAM on the server's unidirectional stream is STREAM_STATE_ERROR (§19.8)", qcStream(n64(3), n64(0), "x", false), state, n64(8));
  refuse(t, "RESET_STREAM on it is too (§19.4)", ending(n64(3), n64(1), n64(0)), state, reset);
  refuse(t, "STREAM_DATA_BLOCKED on it is too (§19.13)", streamValue(QUIC_FRAME_STREAM_DATA_BLOCKED, n64(3), n64(1)), state, toI64(QUIC_FRAME_STREAM_DATA_BLOCKED));
  refuse(t, "MAX_STREAM_DATA on the client's unidirectional stream is STREAM_STATE_ERROR (§19.10)", streamValue(QUIC_FRAME_MAX_STREAM_DATA, n64(2), n64(9)), state, toI64(QUIC_FRAME_MAX_STREAM_DATA));
  refuse(t, "STOP_SENDING on it is too (§19.5)", ending(n64(2), n64(1), n64(-1)), state, toI64(QUIC_FRAME_STOP_SENDING));
  refuse(t, "STREAM on a bidirectional stream of the server's it has not opened is STREAM_STATE_ERROR (§19.8)", qcStream(n64(1), n64(0), "x", false), state, n64(8));
  refuse(t, "MAX_STREAM_DATA on one of its unidirectional streams not opened yet is too (§19.10)", streamValue(QUIC_FRAME_MAX_STREAM_DATA, n64(7), n64(9)), state, toI64(QUIC_FRAME_MAX_STREAM_DATA));
  refuse(t, "a bidirectional stream past the limit of eight is STREAM_LIMIT_ERROR (§4.6)", qcStream(n64(32), n64(0), "x", false), QUIC_ERROR_STREAM_LIMIT, n64(8));
  refuse(t, "a unidirectional stream past the limit of four is too", qcStream(n64(18), n64(0), "x", false), QUIC_ERROR_STREAM_LIMIT, n64(8));
  const noUni = new NqLimits();
  noUni.maxStreamsUni = n64(0);
  refuseUnder(t, "with no unidirectional streams allowed, the first is STREAM_LIMIT_ERROR", noUni, qcStream(n64(2), n64(0), "x", false), QUIC_ERROR_STREAM_LIMIT, n64(8));

  const small = new NqLimits();
  small.maxStreamData = n64(16);
  small.maxData = n64(24);
  refuseUnder(t, "a byte past a stream's credit is FLOW_CONTROL_ERROR (§4.1)", small, qcStream(n64(0), n64(16), "x", false), QUIC_ERROR_FLOW_CONTROL, n64(8));
  refuseUnder(
    t,
    "and past the connection's, over two streams",
    small,
    cat([qcStream(n64(0), n64(0), "0123456789abcdef", false), qcStream(n64(4), n64(0), "012345678", false)]),
    QUIC_ERROR_FLOW_CONTROL,
    n64(8)
  );
  refuseUnder(t, "a RESET_STREAM whose final size is past the credit is FLOW_CONTROL_ERROR too", small, ending(n64(0), n64(1), n64(17)), QUIC_ERROR_FLOW_CONTROL, reset);

  const finalSize: i64 = QUIC_ERROR_FINAL_SIZE;
  refuse(t, "data past a FIN is FINAL_SIZE_ERROR (§4.5)", cat([qcStream(n64(0), n64(0), "abc", true), qcStream(n64(0), n64(3), "d", false)]), finalSize, n64(8));
  refuse(t, "a second FIN at another size is too", cat([qcStream(n64(0), n64(0), "abc", true), qcStream(n64(0), n64(0), "ab", true)]), finalSize, n64(8));
  refuse(t, "a FIN below data already received is too", cat([qcStream(n64(0), n64(0), "abc", false), qcStream(n64(0), n64(0), "a", true)]), finalSize, n64(8));
  refuse(t, "a RESET_STREAM below data already received is too", cat([qcStream(n64(0), n64(0), "abc", false), ending(n64(0), n64(1), n64(2))]), finalSize, reset);
  refuse(t, "a RESET_STREAM at another size than the FIN is too", cat([qcStream(n64(0), n64(0), "abc", true), ending(n64(0), n64(1), n64(4))]), finalSize, reset);
};

/** The client resets a stream, stops one, and the server does both. */
const endingChecks = (t: Suite): void => {
  const p: NqPair = nqPair(new NqLimits());
  nqSend(p, cat([qcStream(n64(0), n64(0), "abcde", false), qcStream(n64(4), n64(0), "x", false), qcStream(n64(8), n64(0), "y", false)]));
  nqReadAll(p.conn, n32(64), new NqRead());
  nqSend(p, ending(n64(0), n64(9), n64(5)));
  const zero = p.conn.streams.find(n64(0));
  t.ok("RESET_STREAM from the client: the receiving side is reset (§3.2)", zero !== null && zero.recvState === QUIC_RECV_RESET_RECVD && zero.resetCode === n64(9));
  const reset = new NqRead();
  nqReadAll(p.conn, n32(64), reset);
  t.eqStr("and the application reads the reset with its code", reset.of(n64(0)), " <reset 9>");
  nqSend(p, ending(n64(0), n64(9), n64(5)));
  t.ok("the same RESET_STREAM again changes nothing", p.conn.state !== QUIC_STATE_CLOSING && toI32(reset.resets.length) === n32(1));

  const data: u8[] = bytesOf("unwanted");
  p.conn.streamWrite(n64(4), data, n32(0), toI32(data.length), false);
  qcDrain(p.conn, p.c);
  nqSend(p, ending(n64(4), n64(7), n64(-1)));
  const answer = qcFind(p.c.appPayloads, QUIC_FRAME_RESET_STREAM);
  t.ok("STOP_SENDING is answered with RESET_STREAM carrying its code and what was sent (§3.5)", answer.found && answer.frame.streamId === n64(4) && answer.frame.errorCode === n64(7) && answer.frame.value === n64(8));
  t.eqI32("and writing to the stream then is QUIC_STREAM_ERR_STOPPED", p.conn.streamWrite(n64(4), data, n32(0), n32(1), false), QUIC_STREAM_ERR_STOPPED);
  const four = p.conn.streams.find(n64(4));
  t.ok("the stream says why: the client's code", four !== null && four.stopCode === n64(7));

  t.eqI32("the server resets stream 8", p.conn.streamReset(n64(8), n64(11)), QUIC_STREAM_OK);
  qcDrain(p.conn, p.c);
  const own: QcFound = qcFind([p.c.appPayloads[toI32(p.c.appPayloads.length) - 1]], QUIC_FRAME_RESET_STREAM);
  t.ok("RESET_STREAM goes out with its code and a final size of 0", own.found && own.frame.streamId === n64(8) && own.frame.errorCode === n64(11) && own.frame.value === n64(0));
  const eight = p.conn.streams.find(n64(8));
  t.ok("the sending side is Reset Sent", eight !== null && eight.sendState === QUIC_SEND_RESET_SENT);
  t.eqI32("so a write is QUIC_STREAM_ERR_FINISHED", p.conn.streamWrite(n64(8), data, n32(0), n32(1), false), QUIC_STREAM_ERR_FINISHED);
  t.eqI32("and resetting again is too", p.conn.streamReset(n64(8), n64(11)), QUIC_STREAM_ERR_FINISHED);
  t.eqI32("the server asks the client to stop sending on 8", p.conn.streamStopSending(n64(8), n64(12)), QUIC_STREAM_OK);
  qcDrain(p.conn, p.c);
  const stop: QcFound = qcFind([p.c.appPayloads[toI32(p.c.appPayloads.length) - 1]], QUIC_FRAME_STOP_SENDING);
  t.ok("STOP_SENDING goes out with its code", stop.found && stop.frame.streamId === n64(8) && stop.frame.errorCode === n64(12));
  nqSettle(p);
  t.ok("once acknowledged, the RESET_STREAM is Reset Recvd", eight !== null && eight.sendState === QUIC_SEND_RESET_RECVD);
  nqSend(p, ending(n64(8), n64(12), n64(1)));
  const gone = new NqRead();
  nqReadAll(p.conn, n32(64), gone);
  t.ok("the client's answering reset ends the stream both ways, and frees its slot", gone.of(n64(8)) === " <reset 12>" && p.conn.streams.find(n64(8)) === null);
};

/** What the stream calls answer for a stream that is not there, a side it does not have, or a connection not up. */
const answerChecks = (t: Suite): void => {
  const p: NqPair = nqPair(new NqLimits());
  nqSend(p, cat([qcStream(n64(2), n64(0), "one way", false), qcStream(n64(0), n64(0), "both", true)]));
  const read = new NqRead();
  nqReadAll(p.conn, n32(64), read);
  const buf: u8[] = new Array<u8>(8);
  t.eqI32("reading a stream never opened is QUIC_STREAM_ERR_UNKNOWN", p.conn.streamRead(n64(40), buf, n32(0), n32(8)), QUIC_STREAM_ERR_UNKNOWN);
  t.eqI32("so is a read outside the buffer given", p.conn.streamRead(n64(2), buf, n32(4), n32(8)), QUIC_STREAM_ERR_UNKNOWN);
  t.eqI32("resetting one is too", p.conn.streamReset(n64(40), n64(1)), QUIC_STREAM_ERR_UNKNOWN);
  t.eqI32("and stopping one", p.conn.streamStopSending(n64(40), n64(1)), QUIC_STREAM_ERR_UNKNOWN);
  t.eqI32("resetting the client's unidirectional stream, which has no sending side, is QUIC_STREAM_ERR_DIRECTION", p.conn.streamReset(n64(2), n64(1)), QUIC_STREAM_ERR_DIRECTION);
  const own: i64 = p.conn.openStream(false);
  t.eqI32("stopping the server's own unidirectional stream, which has no receiving side, is too", p.conn.streamStopSending(own, n64(1)), QUIC_STREAM_ERR_DIRECTION);
  t.eqI32("stopping a stream whose every byte arrived is QUIC_STREAM_ERR_FINISHED", p.conn.streamStopSending(n64(0), n64(1)), QUIC_STREAM_ERR_FINISHED);
  p.conn.close(n64(0));
  t.eqI32("once closed, a reset is QUIC_STREAM_ERR_STATE", p.conn.streamReset(n64(2), n64(1)), QUIC_STREAM_ERR_STATE);
  t.eqI32("and so is STOP_SENDING", p.conn.streamStopSending(n64(2), n64(1)), QUIC_STREAM_ERR_STATE);
};

/** The limits on the server's own streams, and the client's raised as its streams finish. */
const limitChecks = (t: Suite): void => {
  const limits = new NqLimits();
  limits.clientStreamsUni = n64(1);
  limits.localStreams = n64(2);
  const p: NqPair = nqPair(limits);
  t.eqI64("the server opens its first unidirectional stream, 3", p.conn.openStream(false), n64(3));
  t.eqI64("the client allows one: the next is QUIC_STREAM_ERR_LIMIT", p.conn.openStream(false), toI64(QUIC_STREAM_ERR_LIMIT));
  qcDrain(p.conn, p.c);
  const blocked = qcFind(p.c.appPayloads, QUIC_FRAME_STREAMS_BLOCKED_UNI);
  t.ok("and STREAMS_BLOCKED tells the client at which limit (§19.14)", blocked.found && blocked.frame.value === n64(1));
  const more: u8[] = [];
  quicPushValue(more, QUIC_FRAME_MAX_STREAMS_UNI, n64(3));
  nqSend(p, more);
  t.eqI64("MAX_STREAMS from the client lets the next open, 7", p.conn.openStream(false), n64(7));
  t.eqI64("two of the server's are open, its own limit: the next is QUIC_STREAM_ERR_LIMIT", p.conn.openStream(false), toI64(QUIC_STREAM_ERR_LIMIT));
  const done: u8[] = bytesOf("done");
  p.conn.streamWrite(n64(3), done, n32(0), n32(4), true);
  nqSettle(p);
  t.eqStr("a finished stream of the server's arrives", nqReceived(p.c, n64(3)), "done <fin>");
  t.eqI64("and once acknowledged leaves its slot: the next opens, 11", p.conn.openStream(false), n64(11));
};

/** Every refusal and ending check. */
export const refusalChecks = (t: Suite): void => {
  streamRefusals(t);
  endingChecks(t);
  answerChecks(t);
  limitChecks(t);
};
