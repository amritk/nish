// The reset budget (`Http3Config.resetBudget`): every request reset, by the
// client (RESET_STREAM, STOP_SENDING or both, one charge a request) or by the
// server for a stream error or a 431 the client caused, costs one; a response
// the server ends earns one back. The one past the budget closes the
// connection with H3_EXCESSIVE_LOAD: rapid reset (CVE-2023-44487) and
// MadeYouReset (CVE-2025-8671) over HTTP/3. Each case runs under a budget of
// two, so the third reset is the one refused.
import { Suite } from "nish/testing";
import { H3_EXCESSIVE_LOAD, H3_REQUEST_CANCELLED } from "nish/net/http3-frame";
import { Http3Config } from "nish/net/http3";
import { n32, n64 } from "../net_quic_frame/typed";
import { h3Config, h3Connect, H3Limits, H3Peer, h3Saw } from "./peer";

/** A connected pair with the client's streams open, under a reset budget of `budget`. */
const resetBudgeted = (budget: i32): H3Peer => {
  const config: Http3Config = h3Config();
  config.resetBudget = budget;
  const p: H3Peer = h3Connect(new H3Limits(), config);
  p.open(n64(-1));
  p.settle();
  return p;
};

/** Whether the connection was closed with H3_EXCESSIVE_LOAD, the program told. */
const resetCalmed = (p: H3Peer): boolean => p.closeCode === H3_EXCESSIVE_LOAD && h3Saw(p, "error 0x107");

/** Whether the connection still answers a GET on `id`: open, not closed. */
const resetAnswers = (p: H3Peer, id: i64): boolean => {
  p.get(id, "/hello");
  p.settle();
  return p.closeCode === n64(-1) && p.response(id).status === "200";
};

/** A request the program took and answered with a head, its body still open on both sides. */
const resetOpened = (p: H3Peer, id: i64): void => {
  const none: string[] = [];
  p.send(id, p.headers("POST", "/echo", none, none), false);
  p.settle();
};

/** A field section http-fields refuses: an uppercase name, H3_MESSAGE_ERROR. */
const resetMalformed = (p: H3Peer, id: i64): void => {
  p.send(id, p.headers("GET", "/hello", ["X-Bad"], ["1"]), true);
  p.settle();
};

/** A HEADERS frame past `maxFieldSectionSize`, answered with a 431. */
const resetOversized = (p: H3Peer, id: i64): void => {
  const parts: string[] = [];
  for (let k: i32 = 0; k < 20000; k++) {
    parts.push("x");
  }
  p.send(id, p.headers("GET", "/hello", ["x-big"], [parts.join("")]), false);
  p.settle();
};

/** Every check of this file. */
export const resetChecks = (t: Suite): void => {
  t.eqI32("the default budget is a hundred resets", new Http3Config().resetBudget, n32(100));

  const a: H3Peer = resetBudgeted(n32(2));
  for (let k: i32 = 0; k < 2; k++) {
    resetOpened(a, toI64(k * 4));
    a.cancel(toI64(k * 4), H3_REQUEST_CANCELLED);
    a.settle();
  }
  t.ok(
    "two requests the client resets, each with RESET_STREAM and STOP_SENDING, cost one each: the connection still answers",
    h3Saw(a, "reset 0 0x10c by the client") && h3Saw(a, "reset 4 0x10c by the client") && resetAnswers(a, n64(8))
  );
  const b: H3Peer = resetBudgeted(n32(2));
  for (let k: i32 = 0; k < 3; k++) {
    resetOpened(b, toI64(k * 4));
    b.cancel(toI64(k * 4), H3_REQUEST_CANCELLED);
    b.settle();
  }
  t.ok("rapid reset: the third the client resets, past a budget of two, closes the connection with H3_EXCESSIVE_LOAD", resetCalmed(b));
  const c: H3Peer = resetBudgeted(n32(2));
  for (let k: i32 = 0; k < 3; k++) {
    resetOpened(c, toI64(k * 4));
    c.cancelOnly(toI64(k * 4), H3_REQUEST_CANCELLED);
    c.settle();
  }
  t.ok("RESET_STREAM alone, three times: H3_EXCESSIVE_LOAD", resetCalmed(c));
  const d: H3Peer = resetBudgeted(n32(2));
  for (let k: i32 = 0; k < 3; k++) {
    resetOpened(d, toI64(k * 4));
    d.stopOnly(toI64(k * 4), H3_REQUEST_CANCELLED);
    d.settle();
  }
  t.ok("STOP_SENDING alone, three times: H3_EXCESSIVE_LOAD", resetCalmed(d));
  const e: H3Peer = resetBudgeted(n32(2));
  resetMalformed(e, n64(0));
  resetMalformed(e, n64(4));
  t.ok("two malformed requests, reset by the server, leave the connection answering", resetAnswers(e, n64(8)));
  resetMalformed(e, n64(12));
  resetMalformed(e, n64(16));
  t.ok("MadeYouReset: the stream errors the client provokes are charged too, and past the budget close the connection", resetCalmed(e));
  const f: H3Peer = resetBudgeted(n32(2));
  resetOversized(f, n64(0));
  resetOversized(f, n64(4));
  resetOversized(f, n64(8));
  t.ok("a 431 is charged, and never earned back: the third closes the connection", resetCalmed(f));
  const g: H3Peer = resetBudgeted(n32(1));
  let alive: boolean = true;
  for (let k: i32 = 0; k < 10; k++) {
    resetOpened(g, toI64(k * 8));
    g.cancel(toI64(k * 8), H3_REQUEST_CANCELLED);
    g.settle();
    alive = alive && resetAnswers(g, toI64(k * 8 + 4));
  }
  t.ok("a response the server ends earns the budget back: a budget of one takes a reset after every answer, ten times", alive);
};
