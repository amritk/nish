// Every refusal: sessions answered here and never seen by the program (the
// client's SETTINGS without WebTransport's, another `:protocol`, another
// `:scheme`, past the session cap), a malformed extended CONNECT, an
// extended CONNECT where it was not enabled, streams past a session's cap,
// past the waiting room, or naming no session, the connection errors
// (SETTINGS out of range or repeated, a session ID that is no request
// stream, the signal where it may not be, a datagram that does not parse),
// malformed capsules, and each call's refusal.
import { Suite } from "nish/testing";
import {
  H3_DATAGRAM_ERROR,
  H3_FRAME_ERROR,
  H3_FRAME_HEADERS,
  H3_FRAME_WEBTRANSPORT_STREAM,
  H3_ID_ERROR,
  H3_MESSAGE_ERROR,
  H3_NO_ERROR,
  H3_REQUEST_REJECTED,
  H3_SETTINGS_ENABLE_CONNECT_PROTOCOL,
  H3_SETTINGS_ENABLE_WEBTRANSPORT,
  H3_SETTINGS_ERROR,
  H3_SETTINGS_H3_DATAGRAM,
  H3_SETTINGS_WEBTRANSPORT_MAX_SESSIONS,
} from "nish/net/http3-frame";
import { H3_AGAIN, H3_CLOSED, H3_INVALID, H3_TOO_LARGE } from "nish/net/http3";
import { QUIC_ERROR_PROTOCOL_VIOLATION } from "nish/net/quic-frame";
import {
  WT_BUFFERED_STREAM_REJECTED,
  WT_CAPSULE_CLOSE,
  WT_CAPSULE_DRAIN,
  WT_LIMIT,
  WT_SESSION_GONE,
} from "nish/net/webtransport";
import { n32, n64 } from "../net_quic_frame/typed";
import { bytesOf, fromHex } from "../crypto_x509/hex";
import { H3Limits, H3Peer, h3Cat, h3Config, h3Connect, h3Frame, h3Hex, h3Saw, h3Section, h3Varint } from "../net_http3/peer";
import {
  WtLimits,
  WtPeer,
  wtCapsule,
  wtClientSettingIds,
  wtClientSettingValues,
  wtClosePayload,
  wtConnect,
  wtFill,
  wtLogged,
  wtReady,
  wtSaw,
} from "./peer";

/** A client whose SETTINGS are `ids`/`values` asks for a session on stream 0. */
const askWith = (ids: i64[], values: i64[]): WtPeer => {
  const p: WtPeer = wtConnect(new WtLimits());
  p.openWith(ids, values);
  p.session(n64(0), "/echo");
  p.settle();
  return p;
};

/** Sessions answered here, never seen by the program. */
const sessionsRefused = (t: Suite): void => {
  const noDatagrams: WtPeer = askWith(
    [H3_SETTINGS_ENABLE_CONNECT_PROTOCOL, H3_SETTINGS_ENABLE_WEBTRANSPORT, H3_SETTINGS_WEBTRANSPORT_MAX_SESSIONS],
    [n64(1), n64(1), n64(1)],
  );
  t.eqStr("a client whose SETTINGS lack SETTINGS_H3_DATAGRAM is answered 400", noDatagrams.status(n64(0)), ":status: 400");
  t.ok("the program never sees it, and the stream is asked to stop with H3_NO_ERROR", toI32(noDatagrams.log.length) === n32(0) && noDatagrams.stream(n64(0)).stop === H3_NO_ERROR && noDatagrams.wt.sessionsRefused === n32(1));
  const noWebTransport: WtPeer = askWith([H3_SETTINGS_H3_DATAGRAM], [n64(1)]);
  t.eqStr("one with HTTP datagrams but neither WebTransport setting is answered 400", noWebTransport.status(n64(0)), ":status: 400");
  const draft07: WtPeer = askWith([H3_SETTINGS_H3_DATAGRAM, H3_SETTINGS_WEBTRANSPORT_MAX_SESSIONS], [n64(1), n64(4)]);
  t.eqStr("SETTINGS_WEBTRANSPORT_MAX_SESSIONS alone, as a draft-07 client sends it, is enough", draft07.status(n64(0)), ":status: 200; sec-webtransport-http3-draft: draft02");
  const ids: i64[] = [];
  const values: i64[] = [];
  for (let k: i32 = 0; k < 8; k++) {
    ids.push(n64(0x21) + toI64(k) * n64(0x1f));
    values.push(n64(0));
  }
  for (const id of wtClientSettingIds()) {
    ids.push(id);
  }
  for (const value of wtClientSettingValues()) {
    values.push(value);
  }
  const behind: WtPeer = askWith(ids, values);
  t.ok("WebTransport's settings count though eight unknown ones fill the kept list first", behind.status(n64(0)) === ":status: 200; sec-webtransport-http3-draft: draft02" && behind.h3.peer.unknownCount === n32(8));
  const p: WtPeer = wtReady(new WtLimits());
  p.send(n64(4), p.connectFrame("/ws", "websocket", "https"), false);
  p.settle();
  t.eqStr("another :protocol is answered 501 (RFC 8441 §4)", p.status(n64(4)), ":status: 501");
  p.send(n64(8), p.connectFrame("/plain", "webtransport", "http"), false);
  p.settle();
  t.eqStr("an :scheme other than https is answered 400", p.status(n64(8)), ":status: 400");
  p.session(n64(12), "/hold");
  p.session(n64(16), "/third");
  t.eqStr("a session past the cap of two is answered 429", p.status(n64(16)), ":status: 429");
  t.ok("none of them reached the program", !wtSaw(p, "session 4 /ws") && !wtSaw(p, "session 16 /third") && p.wt.sessionsRefused === n32(3));
  p.send(n64(20), h3Frame(H3_FRAME_HEADERS, h3Section(p.enc, [":method", ":scheme", ":authority", ":protocol"], ["CONNECT", "https", "localhost", "webtransport"])), false);
  p.settle();
  t.eqStr("an extended CONNECT without :path is malformed, reset both ways with H3_MESSAGE_ERROR", `${h3Hex(p.stream(n64(20)).reset)} ${h3Hex(p.stream(n64(20)).stop)}`, `${h3Hex(H3_MESSAGE_ERROR)} ${h3Hex(H3_MESSAGE_ERROR)}`);
  const q: WtPeer = wtReady(new WtLimits());
  q.bidi(n64(8), n64(4), bytesOf("waits"), false);
  q.session(n64(4), "/no");
  q.settle();
  t.eqStr("a session the program refuses gets its status", q.status(n64(4)), ":status: 404");
  t.eqStr("and the stream that waited for it is refused with WT_SESSION_GONE", h3Hex(q.stream(n64(8)).reset), h3Hex(WT_SESSION_GONE));
  q.send(n64(12), h3Frame(H3_FRAME_HEADERS, h3Section(q.enc, [":method", ":scheme", ":authority", ":path"], ["GET", "https", "localhost", "/page"])), true);
  q.bidi(n64(16), n64(12), bytesOf("for a GET"), false);
  q.settle();
  wtLogged(t, "a plain request is the program's to answer", q, ["request 12 /page"]);
  t.eqStr("and a stream that names it as its session is refused with WT_SESSION_GONE", h3Hex(q.stream(n64(16)).stop), h3Hex(WT_SESSION_GONE));
};

/** Extended CONNECT where WebTransport is off. */
const connectOff = (t: Suite): void => {
  const p: H3Peer = h3Connect(new H3Limits(), h3Config());
  p.open(n64(-1));
  p.send(n64(0), h3Frame(H3_FRAME_HEADERS, h3Section(p.enc, [":method", ":scheme", ":authority", ":path", ":protocol"], ["CONNECT", "https", "localhost", "/wt", "webtransport"])), false);
  p.settle();
  t.eqI64("where SETTINGS_ENABLE_CONNECT_PROTOCOL was not sent, :protocol is malformed: H3_MESSAGE_ERROR (RFC 9220 §3)", p.stream(n64(0)).reset, H3_MESSAGE_ERROR);
  t.ok("the server's SETTINGS carried no extended CONNECT", p.h3.settingIds.length === 3);
  const config = h3Config();
  config.extendedConnect = true;
  const q: H3Peer = h3Connect(new H3Limits(), config);
  q.open(n64(-1));
  q.send(n64(0), h3Frame(H3_FRAME_HEADERS, h3Section(q.enc, [":method", ":scheme", ":authority", ":path", ":protocol"], ["CONNECT", "https", "localhost", "/tunnel", "connect-udp"])), false);
  q.settle();
  t.ok("extended CONNECT alone is advertised (0x08 = 1) and the request reaches the program", q.h3.settingIds.length === 4 && q.h3.settingIds[3] === H3_SETTINGS_ENABLE_CONNECT_PROTOCOL && h3Saw(q, "request 0 CONNECT /tunnel"));
};

/** Streams past the caps, and naming no session. */
const streamsRefused = (t: Suite): void => {
  const limits = new WtLimits();
  limits.maxStreams = n32(2);
  const p: WtPeer = wtReady(limits);
  p.echo = false;
  p.bidi(n64(4), n64(0), bytesOf("a"), false);
  p.bidi(n64(8), n64(0), bytesOf("b"), false);
  p.bidi(n64(12), n64(0), bytesOf("c"), false);
  t.eqStr("a stream past the session's two is refused both ways with H3_REQUEST_REJECTED", `${h3Hex(p.stream(n64(12)).reset)} ${h3Hex(p.stream(n64(12)).stop)}`, `${h3Hex(H3_REQUEST_REJECTED)} ${h3Hex(H3_REQUEST_REJECTED)}`);
  t.eqI64("and the server may not open one past them", p.wt.openStream(n64(0), true), toI64(WT_LIMIT));
  const pending = new WtLimits();
  pending.maxPending = n32(1);
  const q: WtPeer = wtReady(pending);
  q.bidi(n64(16), n64(12), bytesOf("first"), false);
  q.bidi(n64(20), n64(12), bytesOf("second"), false);
  t.eqI32("one stream waits for session 12", q.wt.waiting.count, n32(1));
  t.eqStr("the next past the waiting room is refused with WT_BUFFERED_STREAM_REJECTED", h3Hex(q.stream(n64(20)).stop), h3Hex(WT_BUFFERED_STREAM_REJECTED));
  q.session(n64(12), "/late");
  q.settle();
  wtLogged(t, "and the one that waited is taken", q, ["session 12 /late", "stream 16 bidi of 12"]);
};

/** The connection errors WebTransport adds. */
const connectionErrors = (t: Suite): void => {
  const twice: WtPeer = askWith([H3_SETTINGS_ENABLE_WEBTRANSPORT, H3_SETTINGS_ENABLE_WEBTRANSPORT], [n64(1), n64(1)]);
  t.eqI64("SETTINGS_ENABLE_WEBTRANSPORT twice is H3_SETTINGS_ERROR", twice.closeCode, H3_SETTINGS_ERROR);
  const datagram: WtPeer = askWith([H3_SETTINGS_H3_DATAGRAM], [n64(2)]);
  t.eqI64("SETTINGS_H3_DATAGRAM of 2 is H3_SETTINGS_ERROR (RFC 9297 §2.1.1)", datagram.closeCode, H3_SETTINGS_ERROR);
  const connect: WtPeer = askWith([H3_SETTINGS_ENABLE_CONNECT_PROTOCOL], [n64(2)]);
  t.eqI64("SETTINGS_ENABLE_CONNECT_PROTOCOL of 2 is H3_SETTINGS_ERROR (RFC 9220 §5)", connect.closeCode, H3_SETTINGS_ERROR);
  const id: WtPeer = wtReady(new WtLimits());
  id.bidi(n64(4), n64(2), bytesOf("x"), false);
  t.ok("a stream naming a session that is no client bidirectional stream is H3_ID_ERROR", id.closeCode === H3_ID_ERROR && id.closeApp);
  const signal: WtPeer = wtReady(new WtLimits());
  const get: u8[] = h3Frame(H3_FRAME_HEADERS, h3Section(signal.enc, [":method", ":scheme", ":authority", ":path"], ["POST", "https", "localhost", "/x"]));
  signal.send(n64(4), h3Cat([get, h3Varint(H3_FRAME_WEBTRANSPORT_STREAM), h3Varint(n64(0))]), false);
  t.eqI64("the stream signal after a request's HEADERS is H3_FRAME_ERROR", signal.closeCode, H3_FRAME_ERROR);
  const empty: WtPeer = wtReady(new WtLimits());
  empty.rawDatagram(wtFill(n32(0), n32(0)));
  t.ok("an empty datagram has no quarter stream ID: H3_DATAGRAM_ERROR", empty.closeCode === H3_DATAGRAM_ERROR && empty.closeApp);
  const huge: WtPeer = wtReady(new WtLimits());
  huge.rawDatagram(h3Cat([fromHex("d000000000000000"), bytesOf("x")]));
  t.eqI64("a quarter stream ID of 2^60, a stream ID past 2^62, is H3_DATAGRAM_ERROR", huge.closeCode, H3_DATAGRAM_ERROR);
  const unknown: WtPeer = wtReady(new WtLimits());
  unknown.datagram(n64(20), bytesOf("nobody"));
  t.ok("a datagram of an unknown session is dropped, counted, and the connection lives", unknown.wt.datagramsDropped === n32(1) && unknown.closeCode === n64(-1) && toI32(unknown.datagrams.length) === n32(0));
  const over: WtPeer = wtReady(new WtLimits());
  over.datagram(n64(0), wtFill(n32(1196), n32(1)));
  t.ok("a datagram whose frame is the server's 1,200 bytes exactly arrives (too large to echo: the client takes less)", wtSaw(over, "datagram 0 1196") && wtSaw(over, "echo refused -90") && over.closeCode === n64(-1));
  over.datagram(n64(0), wtFill(n32(1197), n32(1)));
  t.ok("one byte over is QUIC's PROTOCOL_VIOLATION", over.closeCode === QUIC_ERROR_PROTOCOL_VIOLATION && !over.closeApp);
};

/** Capsules that break the rules. */
const capsulesRefused = (t: Suite): void => {
  const want: string = `${h3Hex(H3_DATAGRAM_ERROR)} ${h3Hex(H3_DATAGRAM_ERROR)}`;
  const short: WtPeer = wtReady(new WtLimits());
  short.capsule(n64(0), wtCapsule(WT_CAPSULE_CLOSE, wtFill(n32(3), n32(0))), false);
  t.eqStr("a CLOSE shorter than its code resets the CONNECT stream with H3_DATAGRAM_ERROR", `${h3Hex(short.stream(n64(0)).reset)} ${h3Hex(short.stream(n64(0)).stop)}`, want);
  wtLogged(t, "and ends the session", short, [`closed 0 0 ""`]);
  const long: WtPeer = wtReady(new WtLimits());
  long.capsule(n64(0), wtCapsule(WT_CAPSULE_CLOSE, wtClosePayload(n64(1), wtFill(n32(1025), n32(97)))), false);
  t.eqStr("a CLOSE whose reason is past 1,024 bytes too", `${h3Hex(long.stream(n64(0)).reset)} ${h3Hex(long.stream(n64(0)).stop)}`, want);
  const fits: WtPeer = wtReady(new WtLimits());
  fits.capsule(n64(0), wtCapsule(WT_CAPSULE_CLOSE, wtClosePayload(n64(1), wtFill(n32(1024), n32(97)))), false);
  t.ok("one of exactly 1,024 is read", toI32(fits.log.join("|").indexOf(`closed 0 1 "aaaa`)) >= 0 && fits.stream(n64(0)).fin);
  const drain: WtPeer = wtReady(new WtLimits());
  drain.capsule(n64(0), wtCapsule(WT_CAPSULE_DRAIN, bytesOf("x")), false);
  t.eqStr("a DRAIN with a payload is H3_DATAGRAM_ERROR", `${h3Hex(drain.stream(n64(0)).reset)} ${h3Hex(drain.stream(n64(0)).stop)}`, want);
  const after: WtPeer = wtReady(new WtLimits());
  after.capsule(n64(0), h3Cat([wtCapsule(WT_CAPSULE_CLOSE, wtClosePayload(n64(1), bytesOf("x"))), wtCapsule(WT_CAPSULE_DRAIN, wtFill(n32(0), n32(0)))]), false);
  t.eqI64("anything after a CLOSE is H3_MESSAGE_ERROR (draft-02 §5): the server's half is finished already, so it asks the client to stop", after.stream(n64(0)).stop, H3_MESSAGE_ERROR);
  wtLogged(t, "though the CLOSE itself was read", after, [`closed 0 1 "x" by the client`]);
  const cut: WtPeer = wtReady(new WtLimits());
  cut.capsule(n64(0), h3Cat([h3Varint(WT_CAPSULE_CLOSE), h3Varint(n64(10)), wtFill(n32(3), n32(0))]), true);
  t.eqI64("a CONNECT stream that ends inside a capsule is H3_DATAGRAM_ERROR (RFC 9297 §3.3)", cut.stream(n64(0)).reset, H3_DATAGRAM_ERROR);
  wtLogged(t, "and the session is over", cut, [`closed 0 0 ""`]);
};

/** Each call's refusals. */
const callsRefused = (t: Suite): void => {
  const p: WtPeer = wtReady(new WtLimits());
  p.session(n64(4), "/hold");
  const x: u8[] = bytesOf("x");
  t.eqI32("refuse with a status outside 400 to 599 is H3_INVALID", p.wt.refuse(n64(4), n32(200)), H3_INVALID);
  t.eqI32("accept of a session already accepted is H3_CLOSED", p.wt.accept(n64(0)), H3_CLOSED);
  t.eqI32("refuse of one already accepted too", p.wt.refuse(n64(0), n32(404)), H3_CLOSED);
  t.eqI32("accept of a stream that is no session", p.wt.accept(n64(8)), H3_CLOSED);
  t.eqI32("a datagram for a session asked for but not answered", p.wt.sendDatagram(n64(4), x, n32(0), n32(1)), H3_CLOSED);
  t.eqI64("a stream for it", p.wt.openStream(n64(4), false), toI64(H3_CLOSED));
  t.eqI32("a close of it", p.wt.close(n64(4), n64(0), x, n32(0), n32(0)), H3_CLOSED);
  t.eqI32("a write to no stream", p.wt.write(n64(8), x, n32(0), n32(1), false), H3_CLOSED);
  t.eqI32("a reset of no stream", p.wt.resetStream(n64(8), n64(0)), H3_CLOSED);
  t.eqI32("a STOP_SENDING for no stream", p.wt.stopSending(n64(8), n64(0)), H3_CLOSED);
  p.uni(n64(14), n64(0), x, false);
  t.eqI32("a write to the client's unidirectional stream, which has no side here", p.wt.write(n64(14), x, n32(0), n32(1), false), H3_CLOSED);
  t.eqI32("the HTTP/3 layer will not let a stream it does not hold go", p.h3.acceptStream(n64(14)), H3_CLOSED);
  t.eqI32("nor refuse one that is no WebTransport stream", p.h3.refuseStream(n64(4), n64(0)), H3_CLOSED);
  t.eqI32("nor write to one", p.h3.writeStream(n64(4), x, n32(0), n32(1), false), H3_CLOSED);
  t.eqI32("nor reset one", p.h3.resetStream(n64(4), n64(0), true), H3_CLOSED);
  t.eqI32("nor stop reading a stream that is no request", p.h3.discardRequest(n64(14), n64(0)), H3_CLOSED);
  t.eqI32("a whole DATA frame on a request with no head yet is H3_INVALID", p.h3.writeDataWhole(n64(4), x, n32(0), n32(1), false), H3_INVALID);
  t.eqI32("one past the stream's buffer is H3_TOO_LARGE", p.h3.writeDataWhole(n64(0), wtFill(n32(32768), n32(0)), n32(0), n32(32768), false), H3_TOO_LARGE);
  t.eqI32("one on no request is H3_CLOSED", p.h3.writeDataWhole(n64(8), x, n32(0), n32(1), false), H3_CLOSED);
  let full: i32 = 0;
  for (let k: i32 = 0; k < 9; k++) {
    full = p.wt.sendDatagram(n64(0), x, n32(0), n32(1));
  }
  t.eqI32("a ninth datagram while QUIC's eight wait to go is H3_AGAIN", full, H3_AGAIN);
  const off: H3Peer = h3Connect(new H3Limits(), h3Config());
  t.eqI64("an HTTP/3 connection without WebTransport opens no WebTransport stream", off.h3.openStream(n64(0), true), toI64(H3_CLOSED));
  t.ok("nor waits for a request's session", !off.h3.awaitsRequest(n64(2)));
};

/** GOAWAY: a session's streams still come, a request past it is refused. */
const afterGoaway = (t: Suite): void => {
  const p: WtPeer = wtReady(new WtLimits());
  p.echo = false;
  t.eqI32("GOAWAY", p.h3.goaway(), n32(0));
  p.bidi(n64(4), n64(0), bytesOf("after"), false);
  wtLogged(t, "a stream of a session after GOAWAY is still taken", p, ["stream 4 bidi of 0"]);
  p.send(n64(8), h3Frame(H3_FRAME_HEADERS, h3Section(p.enc, [":method", ":scheme", ":authority", ":path"], ["GET", "https", "localhost", "/x"])), true);
  t.eqI64("a request past it is refused with H3_REQUEST_REJECTED", p.stream(n64(8)).reset, H3_REQUEST_REJECTED);
  p.send(n64(12), wtFill(n32(0), n32(0)), true);
  t.eqI64("as is a stream that ends before its first frame", p.stream(n64(12)).reset, H3_REQUEST_REJECTED);
  t.eqI32("two refused", p.h3.rejected, n32(2));
};

export const refusalChecks = (t: Suite): void => {
  sessionsRefused(t);
  connectOff(t);
  streamsRefused(t);
  connectionErrors(t);
  capsulesRefused(t);
  callsRefused(t);
  afterGoaway(t);
};
