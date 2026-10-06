// What a request stream refuses without closing the connection, and what
// the write calls refuse. A malformed request is H3_MESSAGE_ERROR (§4.1.2), a
// request stream that ends before its HEADERS is H3_REQUEST_INCOMPLETE
// (§4.1.1), a field section past SETTINGS_MAX_FIELD_SECTION_SIZE is answered
// with a 431 (§4.2.2), trailers past it are H3_EXCESSIVE_LOAD, and unknown
// frames and stream types are skipped (§9, §6.2). Each is a stream error at
// most, so one connection carries every case.
import { Suite } from "nish/testing";
import {
  H3_EXCESSIVE_LOAD,
  H3_FRAME_DATA,
  H3_FRAME_HEADERS,
  H3_MESSAGE_ERROR,
  H3_NO_ERROR,
  H3_REQUEST_CANCELLED,
  H3_REQUEST_INCOMPLETE,
  H3_STREAM_CREATION_ERROR,
} from "nish/net/http3-frame";
import { H3_AGAIN, H3_CLOSED, H3_INVALID, H3_TOO_LARGE } from "nish/net/http3";
import { bytesOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import {
  h3Config,
  H3Limits,
  H3Peer,
  H3Response,
  h3Cat,
  h3Connect,
  h3Frame,
  h3IsPattern,
  h3Logged,
  h3Pattern,
  h3Ready,
  h3Saw,
  h3Section,
  h3Varint,
} from "./peer";

/** A request's HEADERS frame of exactly `names` and `values`, pseudo-headers included. */
const raw = (p: H3Peer, names: string[], values: string[]): u8[] => h3Frame(H3_FRAME_HEADERS, h3Section(p.enc, names, values));

/** A reserved frame of type 0x21 with three bytes of payload, which every receiver skips (§7.2.8). */
const greased = (): u8[] => h3Frame(n64(0x21), [toU8(1), toU8(2), toU8(3)]);

/** A value of `count` copies of `c`. */
const repeat = (c: string, count: i32): string => {
  const parts: string[] = [];
  for (let k: i32 = 0; k < count; k++) {
    parts.push(c);
  }
  return parts.join("");
};

/** Field sections http-fields refuses, each H3_MESSAGE_ERROR on its own stream, never seen by the program. */
const malformed = (t: Suite): void => {
  const p: H3Peer = h3Ready();
  const base: string[] = [":method", ":scheme", ":authority", ":path"];
  const get: string[] = ["GET", "https", "localhost", "/hello"];
  const names: string[][] = [
    [":method", ":scheme", ":authority"],
    [":method", ":scheme", ":authority", ":path", "X-Bad"],
    [":method", ":scheme", ":authority", ":path", "connection"],
    [":method", ":scheme", ":authority", ":path", "transfer-encoding"],
    [":method", ":scheme", "accept", ":authority", ":path"],
    [":method", ":scheme", ":authority", ":path", ":protocol"],
    [":method", ":scheme", ":authority", ":path", ":status"],
    [":method", ":scheme", ":authority", ":path", "host"],
    [":method", ":scheme", ":authority", ":path", "content-length"],
    [":method", ":scheme", ":authority", ":path", "te"],
    [":method", ":scheme", ":authority", ":path", ":method"],
  ];
  const values: string[][] = [
    ["GET", "https", "localhost"],
    ["GET", "https", "localhost", "/", "1"],
    ["GET", "https", "localhost", "/", "keep-alive"],
    ["GET", "https", "localhost", "/", "chunked"],
    ["GET", "https", "*/*", "localhost", "/"],
    ["CONNECT", "https", "localhost", "/", "websocket"],
    ["GET", "https", "localhost", "/", "200"],
    ["GET", "https", "localhost", "/", "elsewhere"],
    ["GET", "https", "localhost", "/", "12a"],
    ["GET", "https", "localhost", "/", "gzip"],
    ["GET", "https", "localhost", "/", "GET"],
  ];
  let all: boolean = true;
  for (let k: i32 = 0; k < toI32(names.length); k++) {
    const id: i64 = toI64(k * 4);
    p.send(id, raw(p, names[k], values[k]), false);
    p.settle();
    all = all && p.stream(id).reset === H3_MESSAGE_ERROR && p.stream(id).stop === H3_MESSAGE_ERROR;
  }
  t.ok("no :path, an uppercase name, connection, transfer-encoding, a pseudo-header after a field, :protocol off, :status, a host that disagrees, a bad content-length, te: gzip, :method twice: each reset both ways with H3_MESSAGE_ERROR", all);
  t.ok("none reached the program", toI32(p.log.length) === n32(0) && p.h3.streamErrors === toI32(names.length));
  p.send(n64(44), raw(p, base, get), true);
  p.settle();
  t.eqStr("and the connection carries on", p.response(n64(44)).status, "200");
};

/** A body that disagrees with its content-length (§4.1.2), and a request that never had HEADERS (§4.1.1). */
const lengths = (t: Suite): void => {
  const p: H3Peer = h3Ready();
  p.send(n64(0), h3Cat([p.headers("POST", "/echo", ["content-length"], ["5"]), h3Frame(H3_FRAME_DATA, bytesOf("abc"))]), true);
  p.settle();
  h3Logged(t, "a body short of its content-length: the program gets the request, then H3_RESET with H3_MESSAGE_ERROR", p, ["request 0 POST /echo", "reset 0 0x10e"]);
  t.eqI64("and the response is reset with it", p.stream(n64(0)).reset, H3_MESSAGE_ERROR);
  p.send(n64(4), h3Cat([p.headers("POST", "/echo", ["content-length"], ["2"]), h3Frame(H3_FRAME_DATA, bytesOf("abc"))]), false);
  p.settle();
  h3Logged(t, "a body past it: H3_RESET as the DATA arrives", p, ["request 4 POST /echo", "reset 4 0x10e"]);
  t.ok("reset both ways", p.stream(n64(4)).reset === H3_MESSAGE_ERROR && p.stream(n64(4)).stop === H3_MESSAGE_ERROR);
  const empty: u8[] = [];
  p.send(n64(8), empty, true);
  p.send(n64(12), greased(), true);
  p.settle();
  t.ok("a stream that ends before HEADERS — empty, or after an unknown frame — is H3_REQUEST_INCOMPLETE", p.stream(n64(8)).reset === H3_REQUEST_INCOMPLETE && p.stream(n64(12)).reset === H3_REQUEST_INCOMPLETE);
  t.ok("unseen by the program", !h3Saw(p, "request 8 GET /hello") && toI32(p.log.length) === n32(4));
  t.eqI32("and every one of them finished", p.h3.live, n32(0));
};

/** Unknown frames and an unknown stream type are skipped (§9, §6.2). */
const unknown = (t: Suite): void => {
  const limits = new H3Limits();
  limits.maxStreamsUni = n64(8);
  const p: H3Peer = h3Connect(limits, h3Config());
  p.open(n64(-1));
  p.settle();
  const body: u8[] = h3Pattern(n32(3000));
  const first: u8[] = [];
  const second: u8[] = [];
  for (let k: i32 = 0; k < 3000; k++) {
    if (k < 1000) {
      first.push(body[k]);
    } else {
      second.push(body[k]);
    }
  }
  const request: u8[] = h3Cat([greased(), p.headers("POST", "/echo", ["content-length"], ["3000"]), h3Frame(H3_FRAME_DATA, first), greased(), h3Frame(n64(31000033), first), h3Frame(H3_FRAME_DATA, second), greased()]);
  p.send(n64(0), request, true);
  p.settle();
  const r: H3Response = p.response(n64(0));
  t.ok("reserved and unknown frames before HEADERS, between DATA and at the end are skipped: the body comes back whole", r.status === "200" && toI32(r.body.length) === n32(3000) && h3IsPattern(r.body) && r.fin);
  p.send(n64(14), h3Cat([h3Varint(n64(0x21)), bytesOf("ignored")]), false);
  t.eqI64("a unidirectional stream of an unknown type is asked to stop with H3_STREAM_CREATION_ERROR", p.stream(n64(14)).stop, H3_STREAM_CREATION_ERROR);
  const empty: u8[] = [];
  p.send(n64(18), empty, true);
  p.send(n64(22), [toU8(0x40)], true);
  t.eqI64("one that ends before its type, or inside it, is let go (§6.2)", p.closeCode, n64(-1));
  p.get(n64(4), "/hello");
  p.settle();
  t.eqStr("and the connection carries on", p.response(n64(4)).status, "200");
};

/** A field section past SETTINGS_MAX_FIELD_SECTION_SIZE is answered with a 431 (§4.2.2); trailers past it are reset. */
const tooLarge = (t: Suite): void => {
  const p: H3Peer = h3Ready();
  // `x` is seven bits in Huffman, so 20,000 of them are a HEADERS frame of about 17,500 bytes, past the 8,192 the frame may be.
  p.send(n64(0), p.headers("GET", "/hello", ["x-big"], [repeat("x", n32(20000))]), false);
  p.settle();
  const r: H3Response = p.response(n64(0));
  t.ok("a HEADERS frame past the limit: skipped, answered 431 with the FIN", r.status === "431" && r.fin && r.whole);
  t.eqI64("and the rest of the request asked to stop, with H3_NO_ERROR (§4.1.2)", p.stream(n64(0)).stop, H3_NO_ERROR);
  // `a` is five bits, so 12,000 of them fit the frame, and the section decodes past the limit.
  p.send(n64(4), p.headers("GET", "/hello", ["x-big"], [repeat("a", n32(12000))]), true);
  p.settle();
  t.eqStr("a section that fits its frame but not the limit once decoded: 431 too", p.response(n64(4)).status, "431");
  t.ok("the program saw neither", toI32(p.log.length) === n32(0) && p.h3.tooLarge === n32(2));
  const huge: u8[] = h3Frame(H3_FRAME_HEADERS, h3Section(p.enc, ["x-big"], [repeat("x", n32(20000))]));
  p.send(n64(8), h3Cat([p.headers("POST", "/echo", ["content-length"], ["0"]), huge]), true);
  p.settle();
  h3Logged(t, "trailers past the limit: the request was the program's, so H3_RESET with H3_EXCESSIVE_LOAD", p, ["request 8 POST /echo", "reset 8 0x107"]);
  const wide: u8[] = h3Frame(H3_FRAME_HEADERS, h3Section(p.enc, ["x-big"], [repeat("a", n32(12000))]));
  p.send(n64(12), h3Cat([p.headers("POST", "/echo", ["content-length"], ["0"]), wide]), true);
  p.settle();
  h3Logged(t, "and trailers past it once decoded", p, ["request 12 POST /echo", "reset 12 0x107"]);
  const bad: u8[] = h3Frame(H3_FRAME_HEADERS, h3Section(p.enc, [":path"], ["/"]));
  p.send(n64(16), h3Cat([p.headers("POST", "/echo", ["content-length"], ["0"]), bad]), true);
  p.settle();
  h3Logged(t, "trailers with a pseudo-header: H3_MESSAGE_ERROR", p, ["request 16 POST /echo", "reset 16 0x10e"]);
  p.get(n64(20), "/hello");
  p.settle();
  t.eqStr("and the connection carries on", p.response(n64(20)).status, "200");
};

/** The client's SETTINGS_MAX_FIELD_SECTION_SIZE bounds the server's responses. */
const peerLimit = (t: Suite): void => {
  const p: H3Peer = h3Connect(new H3Limits(), h3Config());
  p.open(n64(100));
  p.settle();
  t.eqI64("the client's limit is read from its SETTINGS", p.h3.peer.maxFieldSectionSize, n64(100));
  p.get(n64(0), "/hold");
  p.settle();
  t.eqI32("a response head past it is H3_TOO_LARGE: :status, content-type and server count 138", p.h3.respond(n64(0), n32(200), p.names, p.values, false), H3_TOO_LARGE);
  const none: u8[][] = [];
  t.eqI32("one within it goes: :status alone counts 42", p.h3.respond(n64(0), n32(200), none, none, true), n32(0));
  p.settle();
  t.eqStr("and arrives", p.response(n64(0)).status, "200");
};

/** What the write calls refuse, and how a held-back write resumes. */
const writes = (t: Suite): void => {
  const p: H3Peer = h3Ready();
  for (let k: i32 = 0; k < 6; k++) {
    p.get(toI64(k * 4), "/hold");
  }
  p.settle();
  const id: i64 = 0;
  const none: u8[][] = [];
  const buf: u8[] = h3Pattern(n32(65536));
  t.eqI32("a status below 200", p.h3.respond(id, n32(103), none, none, false), H3_INVALID);
  t.eqI32("or past 599: H3_INVALID", p.h3.respond(id, n32(600), none, none, false), H3_INVALID);
  t.eqI32("an uppercase field name", p.h3.respond(id, n32(200), [bytesOf("Server")], [bytesOf("nish")], false), H3_INVALID);
  t.eqI32("a connection-specific field", p.h3.respond(id, n32(200), [bytesOf("connection")], [bytesOf("close")], false), H3_INVALID);
  t.eqI32("more names than values", p.h3.respond(id, n32(200), [bytesOf("server")], none, false), H3_INVALID);
  t.eqI32("DATA before the head", p.h3.writeData(id, buf, n32(0), n32(10), false), H3_INVALID);
  t.eqI32("trailers before the head", p.h3.writeTrailers(id, none, none), H3_INVALID);
  t.eqI32("a stream that is no request of the client's", p.h3.respond(n64(400), n32(200), none, none, false), H3_CLOSED);
  t.eqI32("the server's own control stream", p.h3.respond(n64(3), n32(200), none, none, false), H3_CLOSED);
  t.eqI32("the client's control stream", p.h3.writeData(n64(2), buf, n32(0), n32(1), false), H3_CLOSED);
  t.eqI32("a head", p.h3.respond(id, n32(200), none, none, false), n32(0));
  t.eqI32("and a second: H3_INVALID", p.h3.respond(id, n32(200), none, none, false), H3_INVALID);
  // Fill the 32 KiB send buffer without acknowledging anything.
  let at: i32 = 0;
  let n: i32 = p.h3.writeData(id, buf, at, n32(16384), false);
  while (n === n32(16384)) {
    at = at + n;
    n = p.h3.writeData(id, buf, at, n32(16384), false);
  }
  t.ok("writing until the buffer is full: a write takes less than it was given", n > n32(0) && n < n32(16384));
  at = at + n;
  t.eqI32("then nothing: H3_AGAIN", p.h3.writeData(id, buf, at, n32(16384), false), H3_AGAIN);
  t.eqI32("the FIN inside an unfinished DATA frame: H3_INVALID", p.h3.writeData(id, buf, at, n32(1), true), H3_INVALID);
  t.eqI32("so are trailers there", p.h3.writeTrailers(id, none, none), H3_INVALID);
  const before: i32 = p.writables;
  p.settle();
  t.ok("acknowledgements free room, and H3_WRITABLE names the stream", p.writables > before);
  let rest: i32 = 32768 - at;
  let guard: i32 = 0;
  while (rest > 0 && guard < 100) {
    const took: i32 = p.h3.writeData(id, buf, at, rest, true);
    if (took > 0) {
      at = at + took;
      rest = rest - took;
    } else {
      p.settle();
    }
    guard++;
  }
  p.settle();
  const r: H3Response = p.response(id);
  t.ok("the rest goes, with the FIN: 32,768 bytes in order", toI32(r.body.length) === n32(32768) && h3IsPattern(r.body) && r.fin && r.whole);
  t.eqI32("a write after the FIN", p.h3.writeData(id, buf, n32(0), n32(1), false), H3_CLOSED);
  // A stream reset by the program.
  t.eqI32("reset", p.h3.reset(n64(4), H3_REQUEST_CANCELLED), n32(0));
  p.settle();
  t.eqI64("the client sees RESET_STREAM with the code", p.stream(n64(4)).reset, H3_REQUEST_CANCELLED);
  t.ok("and the stream takes nothing more", p.h3.reset(n64(4), H3_REQUEST_CANCELLED) === H3_CLOSED && p.h3.respond(n64(4), n32(200), none, none, true) === H3_CLOSED);
  t.eqI32("trailers on a stream with no room wait", trailersAt(p, n64(8), n32(1), n32(1)), n32(0));
  t.eqI32("so do trailers on one with none at all", trailersAt(p, n64(12), n32(0), n32(1)), n32(0));
  // 66 bytes is where a filler's one-byte length runs out: its length takes two bytes, 63 written as 40 3f.
  t.eqI32("and on one with 66 bytes, the filler's length written long to fill it exactly", trailersAt(p, n64(16), n32(66), n32(100)), n32(0));
  t.eqI32("and on one with 300", trailersAt(p, n64(20), n32(300), n32(400)), n32(0));
  let padded: boolean = true;
  for (let k: i32 = 2; k < 6; k++) {
    const r: H3Response = p.response(toI64(k * 4));
    padded = padded && r.trailers.startsWith("x-done: ~") && r.whole && r.fin && toI32(r.body.length) > n32(16384);
  }
  t.ok("each arrives after its body, the padding the server wrote to be told of room skipped as an unknown frame", padded);
  p.settle();
  t.eqI32("every request finished", p.h3.live, n32(0));
};

/**
 * Responds on held stream `id` and fills its send buffer to leave `left`
 * bytes, then writes trailers with a value of `valueLength` bytes, too
 * many for that room: H3_AGAIN, then once acknowledgements free
 * room and H3_WRITABLE comes, 0. Answers the second call's answer.
 */
const trailersAt = (p: H3Peer, id: i64, left: i32, valueLength: i32): i32 => {
  const none: u8[][] = [];
  const buf: u8[] = h3Pattern(n32(40000));
  p.h3.respond(id, n32(200), none, none, false);
  p.h3.writeData(id, buf, n32(0), n32(16384), false);
  const s = p.conn.streams.find(id);
  if (s === null) {
    return n32(-1);
  }
  // A DATA frame of L bytes takes L + 3 here: its type, and a two-byte length.
  const fill: i32 = toI32(s.room()) - left - 3;
  p.h3.writeData(id, buf, n32(16384), fill, false);
  const names: u8[][] = [bytesOf("x-done")];
  const values: u8[][] = [bytesOf(repeat("~", valueLength))];
  const first: i32 = p.h3.writeTrailers(id, names, values);
  if (first !== H3_AGAIN || toI32(s.room()) !== n32(0)) {
    return n32(-2);
  }
  const before: i32 = p.writables;
  p.settle();
  if (p.writables === before) {
    return n32(-3);
  }
  const second: i32 = p.h3.writeTrailers(id, names, values);
  p.settle();
  return second;
};

/** Every check of this file. */
export const refusalChecks = (t: Suite): void => {
  malformed(t);
  lengths(t);
  unknown(t);
  tooLarge(t);
  peerLimit(t);
  writes(t);
};
