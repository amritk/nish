// `nish/net/http2`'s refusals, one connection per case, each named by the
// rule of RFC 9113 it enforces:
//
//   - connection errors: the GOAWAY each one sends and the H2_ERROR the
//     program sees, which every later call answers again;
//   - stream errors: the RST_STREAM each one sends, the H2_RESET the program
//     sees when it holds the stream, and a PING after it answered, because
//     the connection lives.
//
// The checks live here so that `tests/link/net_http2_errors_f64` runs every
// one again under `--number-mode f64`.
import {
  H2_CANCEL,
  H2_FLAG_END_HEADERS,
  H2_FLAG_END_STREAM,
  H2_FRAME_PUSH_PROMISE,
  http2WriteHeader,
} from "nish/net/http2-frame";
import { H2_CLOSED, H2_ERROR, Http2Config } from "nish/net/http2";
import { Suite } from "nish/testing";
import { Client, ZERO, getOf, h2Bytes, h2Hex, postOf } from "../net_http2/peer";

/** A connection past both prefaces, under `config`. */
const opened = (config: Http2Config): Client => {
  const c = new Client(config);
  c.open();
  return c;
};

/** No fields. */
const nothing = (): u8[][] => [];

/** A connection past both prefaces with the defaults. */
const fresh = (): Client => opened(new Http2Config());

/** Sends what the client holds and answers `events | frames`. */
const outcome = (c: Client): string => {
  c.send();
  return `${c.takeEvents()} | ${c.takeFrames()}`;
};

/** Whether a PING after everything else is still answered: the connection lives. */
const alive = (c: Client): boolean => {
  c.wire.ping("00000000000000aa");
  c.send();
  return c.takeFrames() === "PING ack 00000000000000aa";
};

/** The frame header for a payload of `length` bytes, as hex, then the payload `hex` spells. */
const frameHex = (length: i32, type: i32, flags: i32, stream: i32, hex: string): string => {
  const out: u8[] = new Array<u8>(9 + length);
  http2WriteHeader(out, ZERO, length, type, flags, stream);
  return `${h2Hex(out).substring(0, 18)}${hex}`;
};

/** Runs every check and answers the exit code. */
export const errorChecks = (): i32 => {
  const t = new Suite("http2 refusals");

  // --- connection errors: the prefaces (§3.4) ----------------------------------------
  const a = new Client(new Http2Config());
  a.takeFrames();
  a.wire.raw(h2Bytes("PRI * HTTP/1.1\r\n\r\nSM\r\n\r\n"));
  t.eqStr("a preface that is not HTTP/2's: PROTOCOL_ERROR", outcome(a), "error 1 | GOAWAY 0 1");
  t.ok("the connection is spent: it takes and drops every byte, answers H2_ERROR again, and is done", a.conn.feed(h2Bytes("more"), ZERO, toI32(4)) === 4 && a.conn.next() === H2_ERROR && a.conn.isDone());
  const b = new Client(new Http2Config());
  b.takeFrames();
  b.wire.preface();
  b.wire.ping("0000000000000000");
  t.eqStr("a first frame that is not SETTINGS: PROTOCOL_ERROR", outcome(b), "error 1 | GOAWAY 0 1");
  const c = new Client(new Http2Config());
  c.takeFrames();
  c.wire.preface();
  c.wire.settingsAck();
  t.eqStr("or that is a SETTINGS acknowledgement", outcome(c), "error 1 | GOAWAY 0 1");

  // --- connection errors: what the frame codec refuses (§4.2, §6) ------------------------
  const d = fresh();
  d.wire.hex("004001000000000001");
  t.eqStr("a frame past SETTINGS_MAX_FRAME_SIZE, refused from its header alone: FRAME_SIZE_ERROR", outcome(d), "error 6 | GOAWAY 0 6");
  const e = fresh();
  e.wire.hex(frameHex(toI32(1), ZERO, ZERO, ZERO, "61"));
  t.eqStr("DATA on stream 0: PROTOCOL_ERROR", outcome(e), "error 1 | GOAWAY 0 1");
  const f = fresh();
  f.wire.hex(frameHex(toI32(5), toI32(4), ZERO, ZERO, "0003000000"));
  t.eqStr("a SETTINGS of five bytes: FRAME_SIZE_ERROR", outcome(f), "error 6 | GOAWAY 0 6");
  const g = fresh();
  g.wire.hex(frameHex(toI32(7), toI32(6), ZERO, ZERO, "00000000000000"));
  t.eqStr("a PING of seven: FRAME_SIZE_ERROR", outcome(g), "error 6 | GOAWAY 0 6");
  const h = fresh();
  h.wire.hex(frameHex(toI32(4), toI32(8), ZERO, ZERO, "00000000"));
  t.eqStr("a WINDOW_UPDATE of zero on the connection: PROTOCOL_ERROR", outcome(h), "error 1 | GOAWAY 0 1");
  const i = fresh();
  i.wire.headers(toI32(1), postOf("/", toI32(2)), ZERO);
  i.wire.hex(frameHex(toI32(3), ZERO, toI32(8), toI32(1), "036162"));
  t.eqStr("padding as long as the DATA it pads: PROTOCOL_ERROR", outcome(i), "request 1 POST /; error 1 | GOAWAY 1 1");
  i.conn.goaway();
  t.ok(
    "after a connection error the program's writes answer H2_CLOSED and a GOAWAY of its own sends nothing",
    i.conn.respond(toI32(1), toI32(200), nothing(), nothing(), true) === H2_CLOSED && i.conn.reset(toI32(1), H2_CANCEL) === H2_CLOSED && i.takeFrames() === ""
  );

  // --- connection errors: header blocks (§6.2, §6.10) -----------------------------------------
  const j = fresh();
  const block: u8[] = j.wire.block(getOf("/"));
  j.wire.continuation(toI32(1), block, ZERO, toI32(block.length), H2_FLAG_END_HEADERS);
  t.eqStr("a CONTINUATION with no header block open: PROTOCOL_ERROR", outcome(j), "error 1 | GOAWAY 0 1");
  const k = fresh();
  k.wire.headersPart(toI32(1), block, ZERO, toI32(4), H2_FLAG_END_STREAM);
  k.wire.ping("0000000000000000");
  t.eqStr("any other frame inside a header block: PROTOCOL_ERROR", outcome(k), "error 1 | GOAWAY 0 1");
  const l = fresh();
  l.wire.headersPart(toI32(1), block, ZERO, toI32(4), H2_FLAG_END_STREAM);
  l.wire.continuation(toI32(3), block, toI32(4), toI32(block.length) - 4, H2_FLAG_END_HEADERS);
  t.eqStr("a CONTINUATION on another stream: PROTOCOL_ERROR", outcome(l), "error 1 | GOAWAY 0 1");
  const m = fresh();
  m.wire.headers(toI32(1), getOf("/"), H2_FLAG_END_STREAM);
  m.wire.raw([toU8(0), toU8(0), toU8(1), toU8(1), toU8(5), toU8(0), toU8(0), toU8(0), toU8(3), toU8(0xff)]);
  t.eqStr("a header block HPACK cannot decode: COMPRESSION_ERROR", outcome(m), "request 1 GET / end; error 9 | GOAWAY 1 9");
  const tight = new Http2Config();
  tight.maxHeaderBlock = 32;
  const n = opened(tight);
  n.wire.headers(toI32(1), [":method", "GET", ":scheme", "https", ":path", "/a-path-long-enough-to-pass-thirty-two-bytes"], H2_FLAG_END_STREAM);
  t.eqStr("a header block longer than maxHeaderBlock: ENHANCE_YOUR_CALM", outcome(n), "error 11 | GOAWAY 0 11");
  const o = fresh();
  o.wire.headersPart(toI32(1), block, ZERO, ZERO, H2_FLAG_END_STREAM);
  for (let r: i32 = 0; r < 64; r++) {
    o.wire.continuation(toI32(1), block, ZERO, ZERO, ZERO);
  }
  t.eqStr("a header block in more than H2_MAX_FRAGMENTS frames: ENHANCE_YOUR_CALM", outcome(o), "error 11 | GOAWAY 0 11");

  // --- connection errors: stream identifiers and states (§5.1, §5.1.1, §8.4) --------------------
  const p = fresh();
  p.wire.headers(toI32(2), getOf("/"), H2_FLAG_END_STREAM);
  t.eqStr("an even stream identifier from a client: PROTOCOL_ERROR", outcome(p), "error 1 | GOAWAY 0 1");
  const q = fresh();
  q.wire.headers(toI32(5), getOf("/five"), H2_FLAG_END_STREAM);
  q.wire.headers(toI32(3), getOf("/three"), H2_FLAG_END_STREAM);
  t.eqStr("an identifier below one already opened, on a stream never seen: PROTOCOL_ERROR", outcome(q), "request 5 GET /five end; error 1 | GOAWAY 5 1");
  const r = fresh();
  r.wire.headers(toI32(1), getOf("/"), H2_FLAG_END_STREAM);
  r.send();
  r.conn.respond(toI32(1), toI32(204), nothing(), nothing(), true);
  r.takeEvents();
  r.takeFrames();
  r.wire.headers(toI32(1), getOf("/"), H2_FLAG_END_STREAM);
  t.eqStr("HEADERS on a stream that has closed: STREAM_CLOSED", outcome(r), "error 5 | GOAWAY 1 5");
  const s = fresh();
  s.wire.headers(toI32(1), postOf("/", toI32(9)), ZERO);
  s.wire.rst(toI32(1), H2_CANCEL);
  s.wire.headers(toI32(1), getOf("/"), H2_FLAG_END_STREAM);
  t.eqStr("and on one the peer reset", outcome(s), "request 1 POST /; reset 1 8 peer; error 5 | GOAWAY 1 5");
  const ga = fresh();
  ga.wire.headers(toI32(1), getOf("/"), H2_FLAG_END_STREAM);
  ga.send();
  ga.conn.goaway();
  ga.takeEvents();
  ga.takeFrames();
  ga.wire.headers(toI32(3), getOf("/"), H2_FLAG_END_STREAM);
  ga.wire.hex(frameHex(toI32(1), ZERO, ZERO, ZERO, "61"));
  t.eqStr("a connection error after the server's GOAWAY names the same last stream, never a higher one (§6.8)", outcome(ga), "error 1 | GOAWAY 1 1");
  const even = fresh();
  even.wire.headers(toI32(5), getOf("/"), H2_FLAG_END_STREAM);
  even.wire.data(toI32(2), "x", ZERO);
  t.eqStr("DATA on an even stream, which a server without push never opens, is on an idle stream: PROTOCOL_ERROR", outcome(even), "request 5 GET / end; error 1 | GOAWAY 5 1");
  const u = fresh();
  u.wire.data(toI32(1), "x", ZERO);
  t.eqStr("DATA on an idle stream: PROTOCOL_ERROR", outcome(u), "error 1 | GOAWAY 0 1");
  const v = fresh();
  v.wire.rst(toI32(1), H2_CANCEL);
  t.eqStr("RST_STREAM on an idle stream: PROTOCOL_ERROR", outcome(v), "error 1 | GOAWAY 0 1");
  const w = fresh();
  w.wire.windowUpdate(toI32(1), toI32(1));
  t.eqStr("WINDOW_UPDATE on an idle stream: PROTOCOL_ERROR", outcome(w), "error 1 | GOAWAY 0 1");
  const x = fresh();
  x.wire.headers(toI32(1), getOf("/"), ZERO);
  x.wire.hex(frameHex(toI32(5), H2_FRAME_PUSH_PROMISE, H2_FLAG_END_HEADERS, toI32(1), "0000000282"));
  t.eqStr("a PUSH_PROMISE from a client: PROTOCOL_ERROR", outcome(x), "request 1 GET /; error 1 | GOAWAY 1 1");
  const budget = new Http2Config();
  budget.resetBudget = 2;
  const y = opened(budget);
  for (let id: i32 = 1; id <= 5; id += 2) {
    y.wire.headers(id, postOf("/", toI32(9)), ZERO);
    y.wire.rst(id, H2_CANCEL);
  }
  t.eqStr(
    "more streams reset by the peer than resetBudget allows: ENHANCE_YOUR_CALM",
    outcome(y),
    "request 1 POST /; reset 1 8 peer; request 3 POST /; reset 3 8 peer; request 5 POST /; error 11 | GOAWAY 5 11"
  );
  const one = new Http2Config();
  one.resetBudget = 1;
  const z = opened(one);
  for (let k: i32 = 0; k < 5; k++) {
    z.wire.headers(4 * k + 1, getOf("/"), H2_FLAG_END_STREAM);
    z.send();
    z.conn.respond(4 * k + 1, toI32(200), nothing(), nothing(), true);
    z.wire.headers(4 * k + 3, postOf("/", toI32(9)), ZERO);
    z.wire.rst(4 * k + 3, H2_CANCEL);
  }
  z.send();
  t.ok("a stream the server finishes earns the budget back: a budget of one takes a reset after every answer", z.takeEvents().indexOf("error") < 0);

  // --- connection errors: flow control and settings (§6.5.2, §6.9) -------------------------------
  const big = new Http2Config();
  big.connectionWindowSize = 65535;
  big.initialWindowSize = 131072;
  big.maxFrameSize = 100000;
  const fa = opened(big);
  fa.wire.headers(toI32(1), postOf("/", toI32(70000)), ZERO);
  fa.wire.dataN(toI32(1), toI32(65536), ZERO);
  t.eqStr("DATA past the connection's window: FLOW_CONTROL_ERROR", outcome(fa), "request 1 POST /; error 3 | GOAWAY 1 3");
  const fb = fresh();
  fb.wire.windowUpdate(ZERO, toI32(2147483647));
  t.eqStr("a WINDOW_UPDATE that takes the connection's window past 2^31 - 1: FLOW_CONTROL_ERROR", outcome(fb), "error 3 | GOAWAY 0 3");
  const fc = fresh();
  fc.wire.hex(frameHex(toI32(6), toI32(4), ZERO, ZERO, "000480000000"));
  t.eqStr("SETTINGS_INITIAL_WINDOW_SIZE of 2^31: FLOW_CONTROL_ERROR", outcome(fc), "error 3 | GOAWAY 0 3");
  const fd = fresh();
  fd.wire.hex(frameHex(toI32(6), toI32(4), ZERO, ZERO, "000200000002"));
  t.eqStr("SETTINGS_ENABLE_PUSH of 2: PROTOCOL_ERROR", outcome(fd), "error 1 | GOAWAY 0 1");
  const fe = fresh();
  fe.wire.hex(frameHex(toI32(6), toI32(4), ZERO, ZERO, "000500003fff"));
  t.eqStr("SETTINGS_MAX_FRAME_SIZE of 16,383: PROTOCOL_ERROR", outcome(fe), "error 1 | GOAWAY 0 1");
  const ff = fresh();
  ff.wire.hex(frameHex(toI32(6), toI32(4), ZERO, ZERO, "000800000002"));
  t.eqStr("SETTINGS_ENABLE_CONNECT_PROTOCOL of 2: PROTOCOL_ERROR", outcome(ff), "error 1 | GOAWAY 0 1");
  const fg = fresh();
  fg.wire.headers(toI32(1), postOf("/", toI32(9)), ZERO);
  fg.wire.windowUpdate(toI32(1), toI32(2147483647 - 65535));
  fg.wire.hex(frameHex(toI32(6), toI32(4), ZERO, ZERO, "000400010000"));
  t.eqStr(
    "a SETTINGS_INITIAL_WINDOW_SIZE that takes an open stream's window past 2^31 - 1: FLOW_CONTROL_ERROR",
    outcome(fg),
    "request 1 POST /; error 3 | GOAWAY 1 3"
  );

  // --- stream errors: malformed requests (§8.1.1) -------------------------------------------------
  const sa = fresh();
  sa.wire.headers(toI32(1), [":method", "GET", ":scheme", "https", ":path", "/", "Accept", "*/*"], H2_FLAG_END_STREAM);
  t.ok("an uppercase field name: the stream is reset with PROTOCOL_ERROR, unseen", outcome(sa) === " | RST_STREAM 1 1" && alive(sa));
  const sb = fresh();
  sb.wire.headers(toI32(1), [":method", "GET", ":scheme", "https", ":path", "/", "connection", "keep-alive"], H2_FLAG_END_STREAM);
  t.ok("a connection-specific field", outcome(sb) === " | RST_STREAM 1 1" && alive(sb));
  const sc = fresh();
  sc.wire.headers(toI32(1), [":method", "GET", ":scheme", "https"], H2_FLAG_END_STREAM);
  t.ok("a request without :path", outcome(sc) === " | RST_STREAM 1 1" && alive(sc));
  const sd = fresh();
  sd.wire.headers(toI32(1), [":method", "CONNECT", ":protocol", "websocket", ":scheme", "https", ":path", "/", ":authority", "a"], ZERO);
  t.ok("a :protocol where extended CONNECT was not enabled", outcome(sd) === " | RST_STREAM 1 1" && alive(sd));
  const se = fresh();
  se.wire.headers(toI32(1), postOf("/", toI32(5)), H2_FLAG_END_STREAM);
  t.ok("a content-length of 5 on a request that ends with its headers", outcome(se) === " | RST_STREAM 1 1" && alive(se));
  const sf = fresh();
  sf.wire.headers(toI32(1), postOf("/", toI32(5)), ZERO);
  sf.wire.data(toI32(1), "abc", H2_FLAG_END_STREAM);
  t.ok("a body shorter than its content-length: the program sees the stream reset", outcome(sf) === "request 1 POST /; reset 1 1 rule | RST_STREAM 1 1" && alive(sf));
  const sg = fresh();
  sg.wire.headers(toI32(1), postOf("/", toI32(2)), ZERO);
  sg.wire.data(toI32(1), "abc", ZERO);
  t.eqStr("a body longer than its content-length", outcome(sg), "request 1 POST /; reset 1 1 rule | RST_STREAM 1 1");
  const sh = fresh();
  sh.wire.headers(toI32(1), postOf("/", toI32(2)), ZERO);
  sh.wire.data(toI32(1), "ab", ZERO);
  sh.wire.headers(toI32(1), ["x-t", "1"], ZERO);
  t.eqStr("trailers without END_STREAM", outcome(sh), 'request 1 POST /; data 1 "ab"; reset 1 1 rule | RST_STREAM 1 1');
  const si = fresh();
  si.wire.headers(toI32(1), postOf("/", toI32(2)), ZERO);
  si.wire.data(toI32(1), "ab", ZERO);
  si.wire.headers(toI32(1), [":status", "200"], H2_FLAG_END_STREAM);
  t.ok("trailers with a pseudo-header", outcome(si) === 'request 1 POST /; data 1 "ab"; reset 1 1 rule | RST_STREAM 1 1' && alive(si));
  const sj = fresh();
  sj.wire.headers(toI32(1), postOf("/", toI32(5)), ZERO);
  sj.wire.data(toI32(1), "ab", ZERO);
  sj.wire.headers(toI32(1), ["x-t", "1"], H2_FLAG_END_STREAM);
  t.ok("trailers that end a body short of its content-length", outcome(sj) === 'request 1 POST /; data 1 "ab"; reset 1 1 rule | RST_STREAM 1 1' && alive(sj));
  const sk = fresh();
  sk.wire.headers(toI32(1), postOf("/", toI32(2)), ZERO);
  sk.wire.headersWithPriority(toI32(1), ["x-t", "1"], toI32(1));
  t.ok("trailers whose HEADERS makes the stream depend on itself", outcome(sk) === "request 1 POST /; reset 1 1 rule | RST_STREAM 1 1" && alive(sk));
  const listCap = new Http2Config();
  listCap.maxHeaderListSize = 240;
  const sl = opened(listCap);
  sl.wire.headers(toI32(1), postOf("/", toI32(2)), ZERO);
  sl.wire.headers(toI32(1), ["x-t", "0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789"], H2_FLAG_END_STREAM);
  t.ok("trailers past SETTINGS_MAX_HEADER_LIST_SIZE", outcome(sl) === "request 1 POST /; reset 1 1 rule | RST_STREAM 1 1" && alive(sl));

  // --- stream errors: states (§5.1) ----------------------------------------------------------------
  const ta = fresh();
  ta.wire.headers(toI32(1), getOf("/"), H2_FLAG_END_STREAM);
  ta.wire.data(toI32(1), "x", ZERO);
  t.ok("DATA after the peer ended the stream: STREAM_CLOSED", outcome(ta) === "request 1 GET / end; reset 1 5 rule | RST_STREAM 1 5" && alive(ta));
  const tb = fresh();
  tb.wire.headers(toI32(1), getOf("/"), H2_FLAG_END_STREAM);
  tb.wire.headers(toI32(1), ["x-t", "1"], H2_FLAG_END_STREAM);
  t.ok("HEADERS after it: STREAM_CLOSED", outcome(tb) === "request 1 GET / end; reset 1 5 rule | RST_STREAM 1 5" && alive(tb));
  const tc = fresh();
  tc.wire.headers(toI32(1), getOf("/"), H2_FLAG_END_STREAM);
  tc.send();
  tc.conn.respond(toI32(1), toI32(200), nothing(), nothing(), true);
  tc.takeEvents();
  tc.takeFrames();
  tc.wire.data(toI32(1), "x", ZERO);
  tc.wire.data(toI32(1), "y", ZERO);
  t.ok("DATA on a closed stream: STREAM_CLOSED, once; what follows is ignored", outcome(tc) === " | RST_STREAM 1 5" && alive(tc));
  const td = new Http2Config();
  td.maxStreams = 1;
  const tdc = opened(td);
  tdc.wire.headers(toI32(1), postOf("/", toI32(9)), ZERO);
  tdc.wire.headers(toI32(3), getOf("/"), H2_FLAG_END_STREAM);
  t.ok("a stream past SETTINGS_MAX_CONCURRENT_STREAMS: REFUSED_STREAM", outcome(tdc) === "request 1 POST / | RST_STREAM 3 7" && alive(tdc));

  // --- stream errors: flow control and priority (§5.3.1, §6.3, §6.9) --------------------------------
  const smallWindow = new Http2Config();
  smallWindow.initialWindowSize = 100;
  const ua = opened(smallWindow);
  ua.wire.headers(toI32(1), postOf("/", toI32(500)), ZERO);
  ua.wire.dataN(toI32(1), toI32(101), ZERO);
  t.ok("DATA past the stream's window: FLOW_CONTROL_ERROR", outcome(ua) === "request 1 POST /; reset 1 3 rule | RST_STREAM 1 3" && alive(ua));
  const ub = fresh();
  ub.wire.headers(toI32(1), postOf("/", toI32(9)), ZERO);
  ub.wire.windowUpdate(toI32(1), toI32(2147483647));
  t.ok("a WINDOW_UPDATE that takes a stream's window past 2^31 - 1: FLOW_CONTROL_ERROR", outcome(ub) === "request 1 POST /; reset 1 3 rule | RST_STREAM 1 3" && alive(ub));
  const uc = fresh();
  uc.wire.headers(toI32(1), postOf("/", toI32(9)), ZERO);
  uc.wire.hex(frameHex(toI32(4), toI32(8), ZERO, toI32(1), "00000000"));
  t.ok("a WINDOW_UPDATE of zero on a stream: PROTOCOL_ERROR", outcome(uc) === "request 1 POST /; reset 1 1 rule | RST_STREAM 1 1" && alive(uc));
  const ud = fresh();
  ud.wire.headers(toI32(1), postOf("/", toI32(9)), ZERO);
  ud.wire.hex(frameHex(toI32(4), toI32(2), ZERO, toI32(1), "00000003"));
  t.ok("a PRIORITY of four bytes on an open stream: FRAME_SIZE_ERROR", outcome(ud) === "request 1 POST /; reset 1 6 rule | RST_STREAM 1 6" && alive(ud));
  const ue = fresh();
  ue.wire.hex(frameHex(toI32(4), toI32(2), ZERO, toI32(7), "00000003"));
  t.ok("and on an idle one, which it does not open", outcome(ue) === " | RST_STREAM 7 6" && alive(ue));
  const uf = fresh();
  uf.wire.headers(toI32(1), postOf("/", toI32(9)), ZERO);
  uf.wire.priority(toI32(3), toI32(1));
  uf.wire.hex(frameHex(toI32(5), toI32(2), ZERO, toI32(1), "0000000110"));
  t.ok("a PRIORITY that makes a stream depend on itself: PROTOCOL_ERROR", outcome(uf) === "request 1 POST /; reset 1 1 rule | RST_STREAM 1 1" && alive(uf));
  const ug = fresh();
  ug.wire.headersWithPriority(toI32(1), getOf("/"), toI32(1));
  t.ok("so does a HEADERS, whose block is decoded all the same", outcome(ug) === " | RST_STREAM 1 1" && alive(ug));
  ug.wire.headers(toI32(3), getOf("/next"), H2_FLAG_END_STREAM);
  t.eqStr("and the next stream reads", outcome(ug), "request 3 GET /next end | ");
  return t.done();
};
