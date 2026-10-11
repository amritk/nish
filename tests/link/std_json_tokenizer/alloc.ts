// Tokenizing a request body allocates nothing: one tokenizer and one output
// buffer, made once, reused for every body, with the arena measured across
// each call the way tests/link/net_loopback/common.ts's LbMeter measures a
// server's wake.
import {
  JSON_TOK_END,
  JSON_TOK_KEY,
  JSON_TOK_NUMBER,
  JSON_TOK_STRING,
  JsonLimits,
  JsonTokenizer,
} from "../../../std/json-tokenizer";
import { Suite } from "../../../std/testing";
import { jtBytes } from "./common";

/** Bodies after the warm-up, every one measured. */
const JT_ALLOC_ROUNDS: i32 = 10000;

/**
 * What the measured calls keep in the arena, summed: how far `Arena.used()`
 * moved across each call, which is exact while nothing is kept. The plain
 * half of `LbMeter`: a body is small, and no call here comes near a chunk.
 */
class JtMeter {
  kept: i64 = 0;
  startUsed: i64 = 0;

  begin(): void {
    this.startUsed = Arena.used();
  }

  end(): void {
    this.kept = this.kept + (Arena.used() - this.startUsed);
  }
}

/**
 * One request: the body's bytes rewritten in place for round `k` (a digit of
 * the id and of the price changes every round, so nothing can be computed
 * once), then every token read, every string copied out, every number parsed,
 * and one key compared. Answers a checksum of what it read.
 */
const jtOneRequest = (tok: JsonTokenizer, body: u8[], out: u8[], k: i32): i64 => {
  const digit: i32 = 48 + (k % 10);
  if (toI32(body.length) > 52) {
    body[8] = toU8(digit);
    body[52] = toU8(digit);
  }
  tok.reset(body, 0, toI32(body.length));
  let sum: i64 = 0;
  let kind: i32 = tok.next();
  while (kind > 0) {
    if (kind === JSON_TOK_KEY || kind === JSON_TOK_STRING) {
      sum = sum + toI64(tok.stringInto(out, 0));
      if (tok.keyEquals("price")) {
        sum = sum + 1000;
      }
    } else if (kind === JSON_TOK_NUMBER) {
      // 1e23 is folded in as a constant, so the sum cannot overflow.
      const x: f64 = tok.numberF64();
      sum = sum + (x < toF64(1000000) ? toI64(x * toF64(100)) : toI64(7));
      if (tok.isInteger()) {
        sum = sum + tok.numberI64();
      }
    }
    kind = tok.next();
  }
  return kind === JSON_TOK_END ? sum : -1;
};

export const jtAlloc = (t: Suite): void => {
  // Two numbers that need parseFloat (`1e23`, 17 digits), escapes and a surrogate pair.
  const body = jtBytes(
    '{"id":1234,"name":"caf\\u00e9 \\ud83d\\ude00","price":12.5,"big":1e23,"long":0.12345678901234567,"tags":["a","b"]}'
  );
  const out = new Array<u8>(toI32(body.length));
  const tok = new JsonTokenizer(body, 0, toI32(body.length), new JsonLimits());
  let checksum: i64 = 0;
  let k: i32 = 0;
  while (k < 5) {
    checksum = checksum + jtOneRequest(tok, body, out, k);
    k += 1;
  }
  const meter = new JtMeter();
  let failures: i32 = 0;
  k = 0;
  while (k < JT_ALLOC_ROUNDS) {
    meter.begin();
    const got: i64 = jtOneRequest(tok, body, out, k);
    meter.end();
    if (got < 0) {
      failures += 1;
    }
    checksum = checksum + got;
    k += 1;
  }
  t.eqI32("alloc: 10,000 reused bodies tokenize to the end", failures, 0);
  t.eqI64("alloc: Arena.used() is flat across every one, parseFloat's numbers included", meter.kept, toI64(0));
  t.ok("alloc: the checksum is the work being done", checksum > 0);

  // The meter is not blind: a call that does keep something shows up.
  const control = new JtMeter();
  const kept: string[] = [];
  control.begin();
  kept.push(`kept ${k}`);
  control.end();
  t.ok("alloc: the meter sees a call that keeps a string", control.kept > 0 && toI32(kept.length) === 1);
};
