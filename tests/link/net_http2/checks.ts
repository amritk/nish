// `nish/net/http2`, the server side of a connection, driven by the scripted
// client in `peer.ts` with no socket:
//
//   1. The prefaces: the server's SETTINGS and WINDOW_UPDATE, the client's
//      preface and SETTINGS, and both acknowledgements.
//   2. A GET and a response streamed a chunk at a time; the same request fed
//      one byte at a time; a POST whose body arrives in pieces and is credited
//      back with WINDOW_UPDATE; a header block across CONTINUATION frames;
//      trailers both ways; a 103 before the 200.
//   3. Flow control stalling and resuming, on a stream and on the connection,
//      and through a new SETTINGS_INITIAL_WINDOW_SIZE.
//   4. Concurrent streams with their frames interleaved, answered out of order.
//   5. PING, the peer's RST_STREAM and GOAWAY, the server's own GOAWAY.
//   6. Extended CONNECT (RFC 8441) and a plain CONNECT, each a tunnel.
//   7. The peer's SETTINGS: a smaller table, a larger frame, a header block
//      split by the peer's frame size; a 431 for a header list past the cap.
//   8. What the program's writes refuse.
//   9. The arena: a thousand frames each way move it not at all; a restart
//      reuses the connection.
//
// The checks live here so that `tests/link/net_http2_f64` runs every one
// again under `--number-mode f64`; the refusals are `tests/link/net_http2_errors`.
import {
  H2_CANCEL,
  H2_FLAG_END_HEADERS,
  H2_FLAG_END_STREAM,
  H2_SETTINGS_HEADER_TABLE_SIZE,
  H2_SETTINGS_INITIAL_WINDOW_SIZE,
  H2_SETTINGS_MAX_FRAME_SIZE,
} from "nish/net/http2-frame";
import { H2_AGAIN, H2_CLOSED, H2_INVALID, H2_NEED_MORE, Http2Config, Http2Stream } from "nish/net/http2";
import { Suite } from "nish/testing";
import { httpFieldBytes } from "nish/net/http-fields";
import { Client, ZERO, filler, getOf, namesOf, postOf, valuesOf } from "./peer";

/** The connection's configuration with the defaults. */
const defaults = (): Http2Config => new Http2Config();

/** No fields beyond `:status`, as the alternating list `namesOf` and `valuesOf` read. */
const none = (): string[] => [];

/** Runs every check and answers the exit code. */
export const http2Checks = (): i32 => {
  const t = new Suite("http2 connection");

  // --- 1. Prefaces -------------------------------------------------------------------
  const a = new Client(defaults());
  t.eqStr(
    "the server's preface is its SETTINGS, then a WINDOW_UPDATE raising the connection's window to 1 MiB",
    a.takeFrames(),
    "SETTINGS 1=4096,3=100,4=65535,5=16384,6=16384; WINDOW_UPDATE 0 983041"
  );
  a.wire.preface();
  a.wire.settings([H2_SETTINGS_MAX_FRAME_SIZE], [toI64(32768)]);
  a.send();
  t.eqStr("the client's preface and SETTINGS are acknowledged, and are no event", `${a.takeFrames()} | ${a.takeEvents()}`, "SETTINGS ack | ");
  t.eqI32("its SETTINGS_MAX_FRAME_SIZE is taken", a.conn.peerMaxFrameSize, toI32(32768));
  a.wire.settingsAck();
  a.send();
  t.ok("its acknowledgement puts the server's own settings in force, and says nothing", a.conn.settingsAcked && a.takeFrames() === "");

  // --- 2. Requests and responses --------------------------------------------------------
  a.wire.headers(toI32(1), getOf("/hello"), H2_FLAG_END_STREAM);
  a.send();
  t.eqStr("a GET with END_STREAM is a request that has ended", a.takeEvents(), "request 1 GET /hello end");
  t.eqStr("its fields are the program's", `${a.conn.fields.scheme.length} ${a.conn.fields.authority.length} ${a.conn.fields.contentLength}`, "5 11 -1");
  t.eqI32("the response head", a.conn.respond(toI32(1), toI32(200), namesOf(["content-type", "text/plain"]), valuesOf(["content-type", "text/plain"]), false), ZERO);
  t.eqI32("a first chunk", a.conn.writeData(toI32(1), httpFieldBytes("hello, "), ZERO, toI32(7), false), toI32(7));
  t.eqI32("and the last", a.conn.writeData(toI32(1), httpFieldBytes("world"), ZERO, toI32(5), true), toI32(5));
  t.eqStr(
    "go out as HEADERS and two DATA frames, the last ending the stream",
    a.takeFrames(),
    'HEADERS 1 :status=200 content-type=text/plain; DATA 1 7 "hello, "; DATA 1 5 "world" end'
  );
  t.eqI32("and the stream is closed: its slot is free", a.conn.active, ZERO);

  const b = new Client(defaults());
  b.open();
  b.wire.headers(toI32(1), getOf("/split"), H2_FLAG_END_STREAM);
  b.wire.ping("0102030405060708");
  b.sendBytewise();
  t.eqStr("the same request fed one byte at a time is the same request", b.takeEvents(), "request 1 GET /split end");
  t.eqStr("and a PING behind it is acknowledged", b.takeFrames(), "PING ack 0102030405060708");

  const small = new Http2Config();
  small.initialWindowSize = 100;
  const c = new Client(small);
  c.open();
  c.wire.headers(toI32(1), postOf("/upload", 130), ZERO);
  c.wire.data(toI32(1), "first part ", ZERO);
  c.send();
  t.eqStr("a POST opens its stream, and its body arrives a frame at a time", c.takeEvents(), 'request 1 POST /upload; data 1 "first part "');
  c.wire.dataN(toI32(1), toI32(49), ZERO);
  c.send();
  t.eqStr("half the stream's window handed on is credited back to the stream", c.takeFrames(), "WINDOW_UPDATE 1 60");
  c.wire.dataN(toI32(1), toI32(70), H2_FLAG_END_STREAM);
  c.send();
  t.eqStr("a body that ends where content-length says ends the request", c.takeEvents(), 'data 1 "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" (49); data 1 "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" (70) end');
  t.eqStr("a stream that has ended is not credited", c.takeFrames(), "");

  const d = new Client(defaults());
  d.open();
  const block: u8[] = d.wire.block(getOf("/continued"));
  d.wire.headersPart(toI32(1), block, ZERO, toI32(3), H2_FLAG_END_STREAM);
  d.wire.continuation(toI32(1), block, toI32(3), toI32(4), ZERO);
  d.wire.continuation(toI32(1), block, toI32(7), toI32(block.length) - 7, H2_FLAG_END_HEADERS);
  d.send();
  t.eqStr("a header block across HEADERS and two CONTINUATIONs is one request", d.takeEvents(), "request 1 GET /continued end");
  d.wire.headers(toI32(3), postOf("/trailers", 4), ZERO);
  d.wire.data(toI32(3), "body", ZERO);
  d.wire.headers(toI32(3), ["x-checksum", "abcd"], H2_FLAG_END_STREAM);
  d.send();
  t.eqStr("trailers end a request", d.takeEvents(), 'request 3 POST /trailers; data 3 "body"; trailers 3 1');
  t.eqI32("a 103 first", d.conn.respond(toI32(3), toI32(103), namesOf(["link", "</s.css>"]), valuesOf(["link", "</s.css>"]), false), ZERO);
  t.eqI32("then the 200", d.conn.respond(toI32(3), toI32(200), namesOf(none()), valuesOf(none()), false), ZERO);
  d.conn.writeData(toI32(3), httpFieldBytes("ok"), ZERO, toI32(2), false);
  t.eqI32("and trailers after the body", d.conn.writeTrailers(toI32(3), namesOf(["grpc-status", "0"]), valuesOf(["grpc-status", "0"])), ZERO);
  t.eqStr(
    "go out in that order, the trailers ending the stream",
    d.takeFrames(),
    'HEADERS 3 :status=103 link=</s.css>; HEADERS 3 :status=200; DATA 3 2 "ok"; HEADERS 3 end grpc-status=0'
  );

  // --- 3. Flow control --------------------------------------------------------------------
  const e = new Client(defaults());
  e.wire.preface();
  e.wire.settings([H2_SETTINGS_INITIAL_WINDOW_SIZE], [toI64(10)]);
  e.wire.settingsAck();
  e.send();
  e.takeFrames();
  e.wire.headers(toI32(1), getOf("/slow"), H2_FLAG_END_STREAM);
  e.send();
  e.takeEvents();
  e.conn.respond(toI32(1), toI32(200), namesOf(none()), valuesOf(none()), false);
  const body: u8[] = httpFieldBytes("abcdefghijklmnopqrstuvwxy");
  t.eqI32("a stream whose window is 10 takes 10 of 25 bytes", e.conn.writeData(toI32(1), body, ZERO, toI32(25), true), toI32(10));
  t.eqI32("then nothing: it is stalled", e.conn.writeData(toI32(1), body, toI32(10), toI32(15), true), H2_AGAIN);
  t.eqStr("and END_STREAM was held back with the rest", e.takeFrames(), 'HEADERS 1 :status=200; DATA 1 10 "abcdefghij"');
  e.wire.windowUpdate(toI32(1), toI32(8));
  e.send();
  t.eqStr("a WINDOW_UPDATE for the stream answers H2_WINDOW", e.takeEvents(), "window 1");
  t.eqI32("and the write resumes as far as the window goes", e.conn.writeData(toI32(1), body, toI32(10), toI32(15), true), toI32(8));
  e.wire.windowUpdate(toI32(1), toI32(100));
  e.send();
  t.ok("again", e.takeEvents() === "window 1" && e.conn.writeData(toI32(1), body, toI32(18), toI32(7), true) === 7);
  t.eqStr("to the end, END_STREAM on the last frame", e.takeFrames(), 'DATA 1 8 "klmnopqr"; DATA 1 7 "stuvwxy" end');
  e.wire.windowUpdate(toI32(1), toI32(5));
  e.send();
  t.eqStr("a WINDOW_UPDATE on a closed stream is ignored", `${e.takeEvents()}|${e.takeFrames()}`, "|");

  const g = new Client(defaults());
  g.wire.preface();
  g.wire.settings([H2_SETTINGS_INITIAL_WINDOW_SIZE], [toI64(1000000)]);
  g.wire.settingsAck();
  g.send();
  g.takeFrames();
  g.wire.headers(toI32(1), getOf("/big"), H2_FLAG_END_STREAM);
  g.send();
  g.takeEvents();
  g.conn.respond(toI32(1), toI32(200), namesOf(none()), valuesOf(none()), false);
  const large: u8[] = filler(70000);
  let sent: i32 = 0;
  let rounds: i32 = 0;
  while (rounds < 20) {
    const n: i32 = g.conn.writeData(toI32(1), large, sent, toI32(70000) - sent, true);
    if (n < 0) {
      break;
    }
    sent = sent + n;
    g.drain();
    rounds = rounds + 1;
  }
  t.eqI32("the connection's window, 65,535, stops a stream with room for more", sent, toI32(65535));
  g.takeFrames();
  g.wire.windowUpdate(ZERO, toI32(10000));
  g.send();
  t.eqStr("a WINDOW_UPDATE for the connection answers H2_WINDOW 0", g.takeEvents(), "window 0");
  t.eqI32("and the rest goes", g.conn.writeData(toI32(1), large, sent, toI32(70000) - sent, true), toI32(70000) - 65535);
  t.eqStr("ending the stream", g.takeFrames(), "DATA 1 4465 end");

  const h = new Client(defaults());
  h.wire.preface();
  h.wire.settings([H2_SETTINGS_INITIAL_WINDOW_SIZE], [toI64(4)]);
  h.wire.settingsAck();
  h.send();
  h.takeFrames();
  h.wire.headers(toI32(1), getOf("/grow"), H2_FLAG_END_STREAM);
  h.send();
  h.takeEvents();
  h.conn.respond(toI32(1), toI32(200), namesOf(none()), valuesOf(none()), false);
  h.conn.writeData(toI32(1), body, ZERO, toI32(25), true);
  t.eqI32("a stalled stream", h.conn.writeData(toI32(1), body, toI32(4), toI32(21), true), H2_AGAIN);
  h.wire.settings([H2_SETTINGS_INITIAL_WINDOW_SIZE], [toI64(30)]);
  h.send();
  t.eqStr("is opened by a larger SETTINGS_INITIAL_WINDOW_SIZE, which moves every window by the difference", h.takeEvents(), "window 0");
  t.eqI32("so 26 more fit", h.conn.writeData(toI32(1), body, toI32(4), toI32(21), true), toI32(21));
  t.eqStr("and the SETTINGS was acknowledged", h.takeFrames(), 'HEADERS 1 :status=200; DATA 1 4 "abcd"; SETTINGS ack; DATA 1 21 "efghijklmnopqrstuvwxy" end');

  // --- 4. Concurrent streams ----------------------------------------------------------------
  const m = new Client(defaults());
  m.open();
  m.wire.headers(toI32(1), postOf("/one", 6), ZERO);
  m.wire.headers(toI32(3), postOf("/three", 6), ZERO);
  m.wire.headers(toI32(5), getOf("/five"), H2_FLAG_END_STREAM);
  m.wire.data(toI32(3), "333", ZERO);
  m.wire.data(toI32(1), "111", ZERO);
  m.wire.data(toI32(3), "333", H2_FLAG_END_STREAM);
  m.wire.data(toI32(1), "111", H2_FLAG_END_STREAM);
  m.send();
  t.eqStr(
    "three streams open at once, their frames interleaved",
    m.takeEvents(),
    'request 1 POST /one; request 3 POST /three; request 5 GET /five end; data 3 "333"; data 1 "111"; data 3 "333" end; data 1 "111" end'
  );
  t.eqI32("each holds a slot", m.conn.active, toI32(3));
  const slot: Http2Stream | null = m.conn.find(toI32(3));
  t.ok(
    "a slot keeps the stream's state: both windows, the declared length and what arrived, which ends have closed",
    slot !== null &&
      slot.id === 3 &&
      slot.sendWindow === toI64(65535) &&
      slot.recvWindow === toI64(65535 - 6) &&
      slot.contentLength === toI64(6) &&
      slot.received === toI64(6) &&
      slot.remoteEnded &&
      !slot.localEnded &&
      !slot.responded
  );
  m.conn.respond(toI32(5), toI32(204), namesOf(none()), valuesOf(none()), true);
  m.conn.respond(toI32(3), toI32(200), namesOf(none()), valuesOf(none()), false);
  m.conn.respond(toI32(1), toI32(200), namesOf(none()), valuesOf(none()), false);
  m.conn.writeData(toI32(3), httpFieldBytes("three"), ZERO, toI32(5), true);
  m.conn.writeData(toI32(1), httpFieldBytes("one"), ZERO, toI32(3), true);
  t.eqStr(
    "answered out of order",
    m.takeFrames(),
    'HEADERS 5 end :status=204; HEADERS 3 :status=200; HEADERS 1 :status=200; DATA 3 5 "three" end; DATA 1 3 "one" end'
  );
  t.eqI32("and every slot is free again", m.conn.active, ZERO);

  // --- 5. PING, RST_STREAM, GOAWAY ------------------------------------------------------------
  const p = new Client(defaults());
  p.open();
  p.wire.ping("fedcba9876543210");
  p.wire.hex("0000080601000000000102030405060708");
  p.send();
  t.eqStr("a PING is acknowledged with its own eight bytes; a PING ACK is not answered", p.takeFrames(), "PING ack fedcba9876543210");
  p.wire.headers(toI32(1), postOf("/cancel", 100), ZERO);
  p.wire.rst(toI32(1), H2_CANCEL);
  p.send();
  t.eqStr("the peer's RST_STREAM ends a stream the program holds", p.takeEvents(), "request 1 POST /cancel; reset 1 8 peer");
  t.ok("frees its slot, and the server sends nothing back", p.conn.active === 0 && p.takeFrames() === "");
  t.eqI32("the program's writes to it answer H2_CLOSED", p.conn.respond(toI32(1), toI32(200), namesOf(none()), valuesOf(none()), true), H2_CLOSED);
  p.wire.rst(toI32(1), H2_CANCEL);
  p.wire.priority(toI32(9), toI32(1));
  p.send();
  t.eqStr("a second RST_STREAM on the closed stream, and a PRIORITY on an idle one, are ignored", `${p.takeEvents()}|${p.takeFrames()}`, "|");
  p.wire.headers(toI32(3), getOf("/last"), H2_FLAG_END_STREAM);
  p.wire.goaway(toI32(3), ZERO);
  p.send();
  t.eqStr("the peer's GOAWAY is an event, after the request before it", p.takeEvents(), "request 3 GET /last end; goaway 3 0");
  t.ok("the connection is not done while stream 3 is open", !p.conn.isDone());
  p.conn.respond(toI32(3), toI32(200), namesOf(none()), valuesOf(none()), true);
  p.drain();
  t.ok("and is once it closes and everything is sent", p.conn.isDone());

  const q = new Client(defaults());
  q.open();
  q.wire.headers(toI32(1), getOf("/a"), H2_FLAG_END_STREAM);
  q.send();
  q.takeEvents();
  q.conn.goaway();
  q.conn.goaway();
  q.wire.headers(toI32(3), postOf("/late", toI32(4)), ZERO);
  q.wire.data(toI32(3), "late", ZERO);
  q.wire.headers(toI32(3), ["x-t", "1"], H2_FLAG_END_STREAM);
  q.wire.ping("0000000000000001");
  q.send();
  t.eqStr("the server's GOAWAY names the last stream it opened, once", q.takeFrames(), "GOAWAY 1 0; PING ack 0000000000000001");
  t.eqStr("a stream opened after it is ignored, and so are its DATA and trailers, without a RST_STREAM (§6.8)", q.takeEvents(), "");
  q.conn.respond(toI32(1), toI32(200), namesOf(none()), valuesOf(none()), true);
  q.drain();
  t.ok("the streams before it finish, and then the connection is done", q.takeFrames() === "HEADERS 1 end :status=200" && q.conn.isDone());

  // --- 6. CONNECT ------------------------------------------------------------------------------------
  const ws = new Http2Config();
  ws.enableConnectProtocol = true;
  const x = new Client(ws);
  t.eqStr("SETTINGS_ENABLE_CONNECT_PROTOCOL is advertised where it is enabled", x.takeFrames(), "SETTINGS 1=4096,3=100,4=65535,5=16384,6=16384,8=1; WINDOW_UPDATE 0 983041");
  x.open();
  x.wire.headers(toI32(1), [":method", "CONNECT", ":protocol", "websocket", ":scheme", "https", ":path", "/chat", ":authority", "example.com", "sec-websocket-version", "13"], ZERO);
  x.send();
  t.eqStr("an extended CONNECT is a request whose :protocol the program reads", x.takeEvents(), "request 1 CONNECT /chat websocket");
  t.eqI32("a 200 accepts the tunnel and leaves the stream open", x.conn.respond(toI32(1), toI32(200), namesOf(none()), valuesOf(none()), false), ZERO);
  x.wire.data(toI32(1), "frame one", ZERO);
  x.wire.data(toI32(1), "frame two", ZERO);
  x.send();
  t.eqStr("DATA in the tunnel is the protocol's bytes", x.takeEvents(), 'data 1 "frame one"; data 1 "frame two"');
  x.conn.writeData(toI32(1), httpFieldBytes("echo"), ZERO, toI32(4), false);
  x.wire.data(toI32(1), "", H2_FLAG_END_STREAM);
  x.send();
  t.eqStr("both ways, and the peer's END_STREAM closes its half", x.takeEvents(), 'data 1 "" end');
  t.eqI32("an empty DATA with END_STREAM closes the server's", x.conn.writeData(toI32(1), httpFieldBytes(""), ZERO, ZERO, true), ZERO);
  t.ok("so the stream is closed", x.takeFrames() === 'HEADERS 1 :status=200; DATA 1 4 "echo"; DATA 1 0 "" end' && x.conn.active === 0);
  x.wire.headers(toI32(3), [":method", "CONNECT", ":authority", "example.com:443"], ZERO);
  x.send();
  t.eqStr("a plain CONNECT names only an authority", x.takeEvents(), "request 3 CONNECT example.com:443");

  // --- 7. The peer's SETTINGS, and the header-list cap -------------------------------------------------
  const s = new Client(defaults());
  s.wire.preface();
  s.wire.settings([H2_SETTINGS_HEADER_TABLE_SIZE], [toI64(0)]);
  s.wire.settingsAck();
  s.send();
  s.takeFrames();
  s.wire.headers(toI32(1), getOf("/table"), H2_FLAG_END_STREAM);
  s.send();
  s.takeEvents();
  s.conn.respond(toI32(1), toI32(200), namesOf(["x-a", "b"]), valuesOf(["x-a", "b"]), true);
  t.eqI32("a peer that sets its table to 0 gets a size update at the start of the next block", toI32(s.conn.output[s.conn.outputStart + 9]), toI32(0x20));
  t.eqStr("which its decoder takes", s.takeFrames(), "HEADERS 1 end :status=200 x-a=b");
  s.wire.headers(toI32(3), getOf("/login"), H2_FLAG_END_STREAM);
  s.send();
  s.takeEvents();
  const cookie: string[] = ["set-cookie", "session=s3cret", "cache-control", "no-store"];
  s.conn.respond(toI32(3), toI32(200), namesOf(cookie), valuesOf(cookie), true);
  t.eqStr("a set-cookie goes out never indexed (RFC 7541 §7.1.3), anything else without indexing", s.takeFrames(), "HEADERS 3 end :status=200 set-cookie=session=s3cret (never indexed) cache-control=no-store");
  const longValue: string[] = [];
  for (let k: i32 = 0; k < 4000; k++) {
    longValue.push("0123456789");
  }
  const huge: string[] = ["x-long", longValue.join("")];
  s.wire.headers(toI32(5), getOf("/long"), H2_FLAG_END_STREAM);
  s.send();
  s.takeEvents();
  t.eqI32("a response head past the peer's frame size", s.conn.respond(toI32(5), toI32(200), namesOf(huge), valuesOf(huge), true), ZERO);
  t.eqStr("goes out as HEADERS and a CONTINUATION", s.takeFrames(), "(fragment 5); HEADERS 5 end +1 :status=200 x-long=(40000 bytes)");
  const carets: string[] = [];
  for (let k: i32 = 0; k < 4000; k++) {
    carets.push("^^^^^^^^^^");
  }
  const rare: string[] = [carets.join(""), "aaaa"];
  s.wire.headers(toI32(7), getOf("/rare"), H2_FLAG_END_STREAM);
  s.send();
  s.takeEvents();
  t.eqI32("a name Huffman would lengthen, beside a value it shortens", s.conn.respond(toI32(7), toI32(200), namesOf(rare), valuesOf(rare), true), ZERO);
  t.eqStr(
    "goes out raw, so the head is no longer than the room checked for it, whole",
    s.takeFrames(),
    "(fragment 7); (fragment 7); HEADERS 7 end +2 :status=200 (40000 bytes)=aaaa"
  );

  const capped = new Http2Config();
  capped.maxHeaderListSize = 200;
  const u = new Client(capped);
  u.open();
  u.wire.headers(toI32(1), [":method", "GET", ":scheme", "https", ":path", "/", "x-big", longValue.join("").substring(0, 300)], H2_FLAG_END_STREAM);
  u.wire.headers(toI32(3), [":method", "POST", ":scheme", "https", ":path", "/", "x-big", longValue.join("").substring(0, 300)], ZERO);
  u.send();
  t.eqStr("a header list past SETTINGS_MAX_HEADER_LIST_SIZE never reaches the program", u.takeEvents(), "");
  t.eqStr(
    "it is answered with a 431, and a stream still open is then reset with NO_ERROR",
    u.takeFrames(),
    "HEADERS 1 end :status=431; HEADERS 3 end :status=431; RST_STREAM 3 0"
  );
  u.wire.data(toI32(3), "late", H2_FLAG_END_STREAM);
  u.wire.headers(toI32(5), getOf("/fine"), H2_FLAG_END_STREAM);
  u.send();
  t.eqStr("its DATA in flight is dropped, and the next request reads", `${u.takeEvents()}|${u.takeFrames()}`, "request 5 GET /fine end|");

  // --- 8. The program's writes -------------------------------------------------------------------------
  const w = new Client(defaults());
  w.open();
  w.wire.headers(toI32(1), postOf("/w", 1), ZERO);
  w.send();
  w.takeEvents();
  t.eqI32("respond on a stream that is not open: H2_CLOSED", w.conn.respond(toI32(7), toI32(200), namesOf(none()), valuesOf(none()), false), H2_CLOSED);
  t.eqI32("so do trailers", w.conn.writeTrailers(toI32(7), namesOf(none()), valuesOf(none())), H2_CLOSED);
  t.eqI32("writeData before the response head: H2_CLOSED", w.conn.writeData(toI32(1), httpFieldBytes("x"), ZERO, toI32(1), false), H2_CLOSED);
  t.eqI32("writeTrailers before it: H2_INVALID", w.conn.writeTrailers(toI32(1), namesOf(none()), valuesOf(none())), H2_INVALID);
  t.eqI32("a 101, which HTTP/2 does not have (§8.6): H2_INVALID", w.conn.respond(toI32(1), toI32(101), namesOf(none()), valuesOf(none()), false), H2_INVALID);
  t.eqI32("a status of 99: H2_INVALID", w.conn.respond(toI32(1), toI32(99), namesOf(none()), valuesOf(none()), false), H2_INVALID);
  t.eqI32("a 1xx that ends the stream: H2_INVALID", w.conn.respond(toI32(1), toI32(100), namesOf(none()), valuesOf(none()), true), H2_INVALID);
  t.eqI32("an uppercase field name: H2_INVALID", w.conn.respond(toI32(1), toI32(200), namesOf(["Content-Type", "x"]), valuesOf(["Content-Type", "x"]), false), H2_INVALID);
  t.eqI32("a connection-specific field: H2_INVALID", w.conn.respond(toI32(1), toI32(200), namesOf(["connection", "close"]), valuesOf(["connection", "close"]), false), H2_INVALID);
  t.eqStr("and nothing went out for any of them", w.takeFrames(), "");
  t.eqI32("a head no output could hold: H2_INVALID", w.conn.respond(toI32(1), toI32(200), namesOf(["x-huge", "v"]), [filler(70000)], false), H2_INVALID);
  t.eqI32("a good head", w.conn.respond(toI32(1), toI32(200), namesOf(none()), valuesOf(none()), false), ZERO);
  t.eqI32("a second final head: H2_INVALID", w.conn.respond(toI32(1), toI32(200), namesOf(none()), valuesOf(none()), false), H2_INVALID);
  w.reading = false;
  const fill: u8[] = filler(16384);
  let filled: i32 = 0;
  for (let k: i32 = 0; k < 8; k++) {
    const n: i32 = w.conn.writeData(toI32(1), fill, ZERO, toI32(16384), false);
    filled = filled + (n > 0 ? n : 0);
  }
  t.eqI32("an output nobody drains takes what fits behind the 10-byte head, in four frames, and keeps its 128-byte reserve", filled, toI32(65536 - 128 - 10 - 9 * 4));
  t.eqI32("then writeData answers H2_AGAIN", w.conn.writeData(toI32(1), fill, ZERO, toI32(16), false), H2_AGAIN);
  w.wire.windowUpdate(ZERO, toI32(1000));
  w.wire.windowUpdate(toI32(1), toI32(1000));
  w.wire.ping("0000000000000001");
  w.wire.ping("0000000000000002");
  w.send();
  t.ok("a peer that does not read stops being read once the reserve is reached", w.conn.inputEnd > w.conn.inputStart && w.conn.next() === H2_NEED_MORE);
  w.reading = true;
  w.drain();
  w.run();
  w.drain();
  t.ok("and is read again once the output drains", w.log.frames[w.log.frames.length - 1] === "PING ack 0000000000000002");
  t.eqI32("reset by the program", w.conn.reset(toI32(1), H2_CANCEL), ZERO);
  t.eqI32("and again: H2_CLOSED", w.conn.reset(toI32(1), H2_CANCEL), H2_CLOSED);
  t.ok("RST_STREAM goes out", w.takeFrames().endsWith("RST_STREAM 1 8"));
  w.wire.data(toI32(1), "x", H2_FLAG_END_STREAM);
  w.send();
  t.eqStr("DATA still in flight for a stream the server reset is ignored (§5.4.2)", `${w.takeEvents()}|${w.takeFrames()}`, "|");

  const full = new Client(defaults());
  full.open();
  full.wire.headers(toI32(1), getOf("/f"), H2_FLAG_END_STREAM);
  full.send();
  full.takeEvents();
  full.conn.respond(toI32(1), toI32(200), namesOf(none()), valuesOf(none()), false);
  full.reading = false;
  full.wire.windowUpdate(ZERO, toI32(1000000));
  full.wire.windowUpdate(toI32(1), toI32(1000000));
  full.send();
  let writes: i32 = 0;
  while (full.conn.writeData(toI32(1), fill, ZERO, toI32(16384), false) > 0 && writes < 10) {
    writes = writes + 1;
  }
  t.eqI32("a head when the output has no room for it: H2_AGAIN", full.conn.writeTrailers(toI32(1), namesOf(["x", "y"]), valuesOf(["x", "y"])), H2_AGAIN);
  t.eqI32("so is an empty DATA that would end the stream", full.conn.writeData(toI32(1), fill, ZERO, ZERO, true), H2_AGAIN);
  t.eqI32("feed takes no more than the input buffer has room for", full.conn.feed(filler(20000), ZERO, toI32(20000)), toI32(16384 + 9));

  const busy = new Client(defaults());
  busy.open();
  for (let id: i32 = 1; id <= 25; id += 2) {
    busy.wire.headers(id, postOf("/", toI32(9)), ZERO);
  }
  busy.wire.windowUpdate(ZERO, toI32(1000000));
  busy.send();
  busy.takeEvents();
  busy.conn.respond(toI32(1), toI32(200), namesOf(none()), valuesOf(none()), false);
  busy.wire.windowUpdate(toI32(1), toI32(1000000));
  busy.send();
  busy.reading = false;
  while (busy.conn.writeData(toI32(1), fill, ZERO, toI32(16384), false) > 0 && writes < 20) {
    writes = writes + 1;
  }
  let resets: i32 = 0;
  let answer: i32 = 0;
  for (let id: i32 = 3; id <= 25 && answer === 0; id += 2) {
    answer = busy.conn.reset(id, H2_CANCEL);
    resets = resets + (answer === 0 ? 1 : 0);
  }
  t.ok(
    `the program's RST_STREAMs use the control reserve, ${resets} of them, then answer H2_AGAIN and leave the stream open`,
    resets >= 9 && answer === H2_AGAIN && busy.conn.find(resets * 2 + 3) !== null
  );
  t.eqI32("so does its GOAWAY", busy.conn.goaway(), H2_AGAIN);
  busy.reading = true;
  busy.drain();
  t.ok("which goes once the output has drained", busy.conn.goaway() === 0 && busy.conn.goawaySent);

  const many = new Client(defaults());
  many.open();
  for (let id: i32 = 1; id <= 39; id += 2) {
    many.wire.headers(id, postOf("/", toI32(1)), ZERO);
  }
  many.send();
  many.takeEvents();
  for (let id: i32 = 1; id <= 39; id += 2) {
    many.conn.reset(id, H2_CANCEL);
  }
  many.takeFrames();
  for (let id: i32 = 1; id <= 39; id += 2) {
    many.wire.data(id, "x", ZERO);
    many.wire.headers(id, ["x-t", "1"], H2_FLAG_END_STREAM);
  }
  many.wire.ping("0000000000000003");
  many.send();
  t.eqStr(
    "twenty streams the program resets at once: what the peer had in flight on each, DATA and trailers, is ignored",
    `${many.takeEvents()}|${many.takeFrames()}`,
    "|PING ack 0000000000000003"
  );

  // --- 9. The arena ---------------------------------------------------------------------------------------
  const r = new Client(defaults());
  r.open();
  r.wire.headers(toI32(1), postOf("/stream", toI32(100000)), ZERO);
  r.send();
  r.takeEvents();
  r.conn.respond(toI32(1), toI32(200), namesOf(none()), valuesOf(none()), false);
  r.takeFrames();
  const chunk: u8[] = filler(100);
  for (let k: i32 = 0; k < 10; k++) {
    r.wire.dataN(toI32(1), toI32(100), ZERO);
  }
  r.wire.windowUpdate(toI32(1), toI32(1000));
  r.wire.windowUpdate(ZERO, toI32(1000));
  r.wire.ping("0102030405060708");
  const burst: u8[] = r.wire.take();
  let moved: i64 = 0;
  let datas: i32 = 0;
  for (let k: i32 = 0; k < 100; k++) {
    const before: i64 = Arena.used();
    let at: i32 = 0;
    while (at < toI32(burst.length)) {
      at = at + r.conn.feed(burst, at, toI32(burst.length) - at);
      let event: i32 = r.conn.next();
      while (event !== H2_NEED_MORE) {
        datas = datas + 1;
        event = r.conn.next();
      }
    }
    r.conn.writeData(toI32(1), chunk, ZERO, toI32(100), false);
    r.conn.consume(r.conn.outputEnd - r.conn.outputStart);
    moved = moved + (Arena.used() - before);
  }
  t.eqI32("a thousand DATA frames in, with WINDOW_UPDATEs, PINGs and a hundred DATA frames out", datas, toI32(1000));
  t.ok(`move the arena not at all (${moved} bytes)`, moved === toI64(0));

  const before: i64 = Arena.used();
  r.conn.restart();
  const after: i64 = Arena.used();
  t.ok(`a restart allocates nothing (${after - before} bytes)`, after === before);
  t.eqStr("and the connection starts again with its SETTINGS", r.takeFrames().substring(0, 8), "SETTINGS");
    r.open();
  r.wire.headers(toI32(1), getOf("/again"), H2_FLAG_END_STREAM);
  r.send();
  t.eqStr("stream 1 is new again", r.takeEvents(), "request 1 GET /again end");
  return t.done();
};
