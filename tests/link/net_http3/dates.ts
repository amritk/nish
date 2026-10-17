// The server's Date on a bare connection given one, as `Http3Server` gives
// each of its slots: one `date` on every final head, straight after
// `:status`, and none on trailers; the program's own in its place; and the
// date counted against the client's SETTINGS_MAX_FIELD_SECTION_SIZE as any
// field is (RFC 9114 §4.2.2). HTTP/3 has no 1xx for a program to send
// (`refusals.ts`), so trailers are the only head without a status.
import { Suite } from "nish/testing";
import { H3_INVALID, H3_TOO_LARGE } from "nish/net/http3";
import { bytesOf } from "../crypto_x509/hex";
import { n32, n64 } from "../net_quic_frame/typed";
import { h3Config, H3Limits, H3Peer, H3Response, h3Connect, h3Ready } from "./peer";

/** The date the checks give the connection, as a pinned `HttpDate` formats it. */
const PINNED: string = "Fri, 16 Oct 2026 08:11:54 GMT";

/** A connection whose client limits a field section to `max`, with stream 0 open and unanswered. */
const limited = (max: i64): H3Peer => {
  const p: H3Peer = h3Connect(new H3Limits(), h3Config());
  p.open(max);
  p.settle();
  p.get(n64(0), "/hold");
  p.settle();
  return p;
};

/** `count` copies of `v`. */
const filled = (count: i32): u8[] => {
  const out: u8[] = [];
  for (let k: i32 = 0; k < count; k++) {
    out.push(toU8(118));
  }
  return out;
};

/** Every check of the date. */
export const dateChecks = (t: Suite): void => {
  const p: H3Peer = h3Ready();
  p.h3.date = bytesOf(PINNED);
  p.get(n64(0), "/hello");
  p.get(n64(4), "/trailers");
  p.get(n64(8), "/hold");
  p.get(n64(12), "/hold");
  p.settle();
  t.eqStr("a final response carries one date, straight after :status", p.response(n64(0)).fields, `date: ${PINNED}; content-type: text/plain; server: nish`);
  const r: H3Response = p.response(n64(4));
  t.ok("trailers carry none", r.fields.startsWith(`date: ${PINNED};`) && r.trailers.startsWith("x-checksum: abc123") && toI32(r.trailers.indexOf("date")) < 0);
  const own: u8[][] = [bytesOf("date")];
  const when: u8[][] = [bytesOf("Thu, 01 Jan 1970 00:00:00 GMT")];
  t.eqI32("a head with the program's own date", p.h3.respond(n64(8), n32(200), own, when, true), n32(0));
  const mixed: u8[][] = [bytesOf("Date")];
  t.eqI32("a mixed-case Date, which HTTP/3 does not allow (§4.2): H3_INVALID", p.h3.respond(n64(12), n32(200), mixed, when, true), H3_INVALID);
  p.settle();
  t.eqStr("goes out with that date alone, never two", p.response(n64(8)).fields, "date: Thu, 01 Jan 1970 00:00:00 GMT");
  t.ok("and nothing went out for the mixed case", toI32(p.stream(n64(12)).data.length) === n32(0));

  const bare: H3Peer = h3Ready();
  bare.get(n64(0), "/hello");
  bare.settle();
  t.eqStr("a connection with no server to keep the clock sends no date", bare.response(n64(0)).fields, "content-type: text/plain; server: nish");

  // `:status: 200` counts 42 and the date 65 (4 + 29 + 32); `x` with 32 bytes counts 65 too.
  const x: u8[][] = [bytesOf("x")];
  const v: u8[][] = [filled(n32(32))];
  const exact: H3Peer = limited(n64(107));
  t.eqI32("with no date, a head that fills the client's limit exactly goes", exact.h3.respond(n64(0), n32(200), x, v, true), n32(0));
  const counted: H3Peer = limited(n64(107));
  counted.h3.date = bytesOf(PINNED);
  t.eqI32("with one, the same head is H3_TOO_LARGE: the date counts", counted.h3.respond(n64(0), n32(200), x, v, true), H3_TOO_LARGE);
  const none: u8[][] = [];
  t.eqI32("and :status with the date alone fill it exactly", counted.h3.respond(n64(0), n32(200), none, none, true), n32(0));
  counted.settle();
  t.eqStr("and arrive", `${counted.response(n64(0)).status} ${counted.response(n64(0)).fields}`, `200 date: ${PINNED}`);

  const big: H3Peer = h3Ready();
  big.h3.date = bytesOf(PINNED);
  const huge: string[] = [];
  for (let k: i32 = 0; k < 2000; k++) {
    huge.push("xxxxxxxxxx");
  }
  big.send(n64(0), big.headers("GET", "/hello", ["x-big"], [huge.join("")]), false);
  big.settle();
  const refused: H3Response = big.response(n64(0));
  t.eqStr("the server's own 431 is a final response too, and carries the date", `${refused.status} ${refused.fields}`, `431 date: ${PINNED}`);
};
