// Requests and responses over one connection, through the client of
// `peer.ts`: the server's own streams and SETTINGS, a GET, a POST whose body
// is larger than any buffer on either side and comes back streamed, many
// requests at once, trailers both ways, GOAWAY with requests in flight, the
// client's GOAWAY and push frames, and requests the client cancels.
import { Suite } from "nish/testing";
import { H3_FRAME_CANCEL_PUSH, H3_FRAME_DATA, H3_FRAME_GOAWAY, H3_FRAME_HEADERS, H3_FRAME_MAX_PUSH_ID, H3_REQUEST_CANCELLED, H3_REQUEST_REJECTED } from "nish/net/http3-frame";
import { bytesOf, textOf, toHex } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import {
  CLIENT_CONTROL,
  H3AppStream,
  H3Peer,
  H3Response,
  SERVER_CONTROL,
  h3Cat,
  h3Frame,
  h3IsPattern,
  h3Logged,
  h3Pattern,
  h3Fresh,
  h3Ready,
  h3Saw,
  h3Section,
  h3Varint,
} from "./peer";

/** The server's control stream carries its type and SETTINGS, and its QPACK streams their types (§6.2.1, RFC 9204 §4.2). */
const setup = (t: Suite): void => {
  const p: H3Peer = h3Ready();
  // 00 is the control stream's type; 04 09 SETTINGS, then QPACK_MAX_TABLE_CAPACITY 0,
  // QPACK_BLOCKED_STREAMS 0, and MAX_FIELD_SECTION_SIZE 16,384 as 80 00 40 00.
  t.eqStr("the server's control stream: its type, then SETTINGS first", toHex(p.stream(SERVER_CONTROL).data), "000409010007000680004000");
  t.eqStr("its QPACK encoder stream: its type, and nothing at capacity 0", toHex(p.stream(n64(7)).data), "02");
  t.eqStr("its QPACK decoder stream likewise", toHex(p.stream(n64(11)).data), "03");
  t.ok("none of the three ends", !p.stream(SERVER_CONTROL).fin && !p.stream(n64(7)).fin && !p.stream(n64(11)).fin);
  t.ok("the client's SETTINGS arrived, its reserved identifier 0x21 kept, not refused", p.h3.settingsSeen && p.h3.peer.unknown(n64(0x21)) === n64(7));
  t.eqI64("and with no SETTINGS_MAX_FIELD_SECTION_SIZE, the client's limit is none", p.h3.peer.maxFieldSectionSize, n64(-1));
  t.ok("the client's streams are its control, encoder and decoder", p.h3.peerControl === n64(2) && p.h3.peerEncoder === n64(6) && p.h3.peerDecoder === n64(10));
  // RFC 9204 §4.3.1 and §4.4.2: what capacity 0 lets either side say.
  p.send(n64(6), [toU8(0x20)], false);
  p.send(n64(10), [toU8(0x44)], false);
  t.ok("Set Dynamic Table Capacity 0 on the client's encoder stream is accepted", p.h3.decoder.capacityInstructions === n32(1) && p.closeCode === n64(-1));
  t.ok("as is a Stream Cancellation on its decoder stream", p.h3.encoder.cancellations === n32(1) && p.h3.encoder.lastCancelled === n64(4));
};

/** A GET, and a path the application does not know. */
const get = (t: Suite): void => {
  const p: H3Peer = h3Ready();
  p.get(n64(0), "/hello");
  p.settle();
  const r: H3Response = p.response(n64(0));
  t.eqStr("a GET of /hello: 200", r.status, "200");
  t.eqStr("with the fields the program gave", r.fields, "content-type: text/plain; server: nish");
  t.eqStr("then its body in DATA, then the FIN", `${textOf(r.body)} ${r.frames} ${r.fin} ${r.whole}`, "hello, h3 1 true true");
  h3Logged(t, "the program saw the request, then its end", p, ["request 0 GET /hello", "end 0"]);
  p.get(n64(4), "/missing");
  p.settle();
  const missing: H3Response = p.response(n64(4));
  t.eqStr("a path it does not know: 404, HEADERS alone with the FIN", `${missing.status} ${missing.frames} ${missing.fin} ${missing.whole}`, "404 0 true true");
  p.settle();
  t.eqI32("both finished both ways: no request open", p.h3.live, n32(0));
  t.eqI64("and the connection is open", p.closeCode, n64(-1));
};

/** A POST of 200,000 bytes, echoed: bodies streamed both ways through buffers of 32 KiB. */
const post = (t: Suite): void => {
  const p: H3Peer = h3Ready();
  const total: i32 = 200000;
  const body: u8[] = h3Pattern(total);
  p.send(n64(0), p.headers("POST", "/echo", ["content-length"], [`${total}`]), false);
  // Four DATA frames of 50,000 bytes, each larger than every buffer it passes through.
  for (let k: i32 = 0; k < 4; k++) {
    const part: u8[] = [];
    for (let j: i32 = 0; j < 50000; j++) {
      part.push(body[k * 50000 + j]);
    }
    p.send(n64(0), h3Frame(H3_FRAME_DATA, part), k === 3);
  }
  p.settle();
  const r: H3Response = p.response(n64(0));
  t.eqStr("the response: 200", r.status, "200");
  t.ok("the 200,000 bytes come back whole and in order, then the FIN", toI32(r.body.length) === total && h3IsPattern(r.body) && r.fin && r.whole);
  const s: H3AppStream | null = p.app(n64(0));
  t.ok("the program read every byte of the request", s !== null && s.received === toI64(total));
  t.ok("never more than a body chunk, 16,384 bytes, at a time", s !== null && s.largest > n32(0) && s.largest <= n32(16384));
  t.ok("the response went in DATA frames of at most writeChunk", r.largest <= n32(16384) && r.frames >= n32(13));
  t.ok("held back by the send buffer and resumed: H3_WRITABLE came", p.writables > n32(0));
  t.ok("and the request ended whole: its content-length matched", h3Saw(p, "end 0"));
  t.eqI64("the client never sent past the credit it had: no error", p.closeCode, n64(-1));
};

/** Twelve requests open at once on one connection, and two large responses interleaved. */
const concurrent = (t: Suite): void => {
  const p: H3Peer = h3Ready();
  const none: string[] = [];
  for (let k: i32 = 0; k < 12; k++) {
    p.send(toI64(k * 4), p.headers("GET", "/hello", none, none), false);
  }
  const empty: u8[] = [];
  for (let k: i32 = 11; k >= 0; k--) {
    p.send(toI64(k * 4), empty, true);
  }
  p.settle();
  let all: boolean = true;
  for (let k: i32 = 0; k < 12; k++) {
    const r: H3Response = p.response(toI64(k * 4));
    all = all && r.status === "200" && textOf(r.body) === "hello, h3" && r.fin;
  }
  t.ok("twelve GETs open at once, ended in reverse: twelve whole responses", all);
  t.ok("the program had every request before any ended", p.log.indexOf("request 44 GET /hello") < p.log.indexOf("end 44") && p.log.indexOf("end 44") < p.log.indexOf("end 0"));
  const none2: string[] = [];
  p.send(n64(48), p.headers("GET", "/big/60000", none2, none2), true);
  p.send(n64(52), p.headers("GET", "/big/70000", none2, none2), true);
  p.settle();
  const a: H3Response = p.response(n64(48));
  const b: H3Response = p.response(n64(52));
  t.ok("two large responses at once, each whole", toI32(a.body.length) === n32(60000) && h3IsPattern(a.body) && toI32(b.body.length) === n32(70000) && h3IsPattern(b.body) && a.fin && b.fin);
  p.settle();
  t.eqI32("and every request finished", p.h3.live, n32(0));
};

/** Trailers on a request and on its response (§4.1). */
const trailers = (t: Suite): void => {
  const p: H3Peer = h3Ready();
  const names: string[] = ["x-sum"];
  const values: string[] = ["6"];
  const tail: u8[] = h3Frame(H3_FRAME_HEADERS, h3Section(p.enc, names, values));
  const request: u8[] = h3Cat([p.headers("POST", "/trailers", ["content-length"], ["3"]), h3Frame(H3_FRAME_DATA, bytesOf("abc")), tail]);
  p.send(n64(0), request, true);
  p.settle();
  h3Logged(t, "the program saw the request, its trailers, then its end", p, ["request 0 POST /trailers", "trailers 0 x-sum=6", "end 0"]);
  const r: H3Response = p.response(n64(0));
  t.eqStr("the response: 200, its body", `${r.status} ${textOf(r.body)}`, "200 with trailers");
  t.eqStr("then its trailers, which end it", `${r.trailers} ${r.fin} ${r.whole}`, "x-checksum: abc123; x-count: 3 true true");
};

/** GOAWAY with requests in flight (§5.2): those below its ID finish, a later one is refused. */
const goaway = (t: Suite): void => {
  const p: H3Peer = h3Ready();
  t.eqI32("GOAWAY before the server's control stream is open: H3_AGAIN", h3Fresh().goaway(), n32(-11));
  for (let k: i32 = 0; k < 3; k++) {
    p.get(toI64(k * 4), "/hold");
  }
  p.settle();
  t.eqI32("three requests held, then GOAWAY", p.h3.goaway(), n32(0));
  p.settle();
  t.eqStr("it names stream 12, the first the client has not opened: 07 01 0c", toHex(p.stream(SERVER_CONTROL).data).slice(n32(24)), "07010c");
  t.ok("with those three still open", p.h3.live === n32(3) && !p.h3.isDone());
  const none: string[] = [];
  p.send(n64(12), p.headers("GET", "/hello", none, none), false);
  p.settle();
  t.ok("a request on stream 12 is refused both ways with H3_REQUEST_REJECTED", p.stream(n64(12)).reset === H3_REQUEST_REJECTED && p.stream(n64(12)).stop === H3_REQUEST_REJECTED);
  p.get(n64(16), "/hello");
  p.settle();
  t.ok("one that arrived whole has only its response refused: nothing is left to stop", p.stream(n64(16)).reset === H3_REQUEST_REJECTED && p.stream(n64(16)).stop === n64(-1));
  t.ok("before the program sees either", !h3Saw(p, "request 12 GET /hello") && !h3Saw(p, "request 16 GET /hello") && p.h3.rejected === n32(2));
  p.release();
  p.settle();
  let finished: boolean = true;
  for (let k: i32 = 0; k < 3; k++) {
    const r: H3Response = p.response(toI64(k * 4));
    finished = finished && r.status === "200" && textOf(r.body) === "released" && r.fin;
  }
  t.ok("the three in flight finish normally", finished);
  t.ok("and with every response acknowledged, the connection is done", p.h3.isDone());
  t.eqI32("a second GOAWAY", p.h3.goaway(), n32(0));
  p.settle();
  t.eqStr("never raises the ID", toHex(p.stream(SERVER_CONTROL).data).slice(n32(24)), "07010c07010c");
};

/** The client's own GOAWAY, MAX_PUSH_ID and CANCEL_PUSH: a server that never pushes checks them and goes on (§5.2, §7.2.7, §7.2.3). */
const clientFrames = (t: Suite): void => {
  const p: H3Peer = h3Ready();
  p.send(CLIENT_CONTROL, h3Cat([h3Frame(H3_FRAME_MAX_PUSH_ID, h3Varint(n64(5))), h3Frame(H3_FRAME_CANCEL_PUSH, h3Varint(n64(3)))]), false);
  t.ok("MAX_PUSH_ID 5, then CANCEL_PUSH of push 3: no error", p.closeCode === n64(-1) && p.h3.maxPushId === n64(5));
  p.send(CLIENT_CONTROL, h3Frame(H3_FRAME_GOAWAY, h3Varint(n64(4))), false);
  p.send(CLIENT_CONTROL, h3Frame(H3_FRAME_GOAWAY, h3Varint(n64(4))), false);
  h3Logged(t, "the client's GOAWAY reaches the program, its push ID with it, and again", p, ["goaway 4", "goaway 4"]);
  p.get(n64(0), "/hello");
  p.settle();
  t.eqStr("and requests go on", p.response(n64(0)).status, "200");
};

/** Requests the client cancels (§4.1.1). */
const cancelled = (t: Suite): void => {
  const p: H3Peer = h3Ready();
  p.send(n64(0), p.headers("POST", "/echo", ["content-length"], ["5000"]), false);
  p.send(n64(0), h3Frame(H3_FRAME_DATA, h3Pattern(n32(1000))), false);
  p.settle();
  p.cancel(n64(0), H3_REQUEST_CANCELLED);
  p.settle();
  h3Logged(t, "a request the client cancels mid-body reaches the program as H3_RESET with its code", p, ["request 0 POST /echo", "reset 0 0x10c by the client"]);
  t.eqI64("the server's half ends with the same code", p.stream(n64(0)).reset, H3_REQUEST_CANCELLED);
  t.eqI32("and no request is open", p.h3.live, n32(0));
  // RESET_STREAM alone, after the request's head: the response cannot finish either.
  p.send(n64(4), p.headers("POST", "/echo", ["content-length"], ["5000"]), false);
  p.settle();
  p.cancelOnly(n64(4), H3_REQUEST_CANCELLED);
  p.settle();
  t.ok("RESET_STREAM alone: the program is told, and the server abandons its response with H3_REQUEST_CANCELLED", h3Saw(p, "reset 4 0x10c by the client") && p.stream(n64(4)).reset === H3_REQUEST_CANCELLED); 
  // STOP_SENDING alone: the client wants no response, and the program is told.
  p.get(n64(8), "/hold");
  p.settle();
  p.stopOnly(n64(8), H3_REQUEST_CANCELLED);
  p.settle();
  t.ok("STOP_SENDING alone: H3_RESET with its code, and QUIC's RESET_STREAM answering it", h3Saw(p, "reset 8 0x10c by the client") && p.stream(n64(8)).reset === H3_REQUEST_CANCELLED);
  p.settle();
  t.eqI32("every one of them finished", p.h3.live, n32(0));
  t.eqI64("and the connection lives", p.closeCode, n64(-1));
};

/** Every check of this file. */
export const requestChecks = (t: Suite): void => {
  setup(t);
  get(t);
  post(t);
  concurrent(t);
  trailers(t);
  goaway(t);
  clientFrames(t);
  cancelled(t);
};
