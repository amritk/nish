// Tokenizing one request body over and over with `nish/json-tokenizer`: every
// token read, every string copied out with `stringInto`, every number parsed
// with `numberF64`, and one key compared with `keyEquals`, into buffers made
// once. One digit of the body changes every round, so no round can be
// computed once, and every token's kind, each string's length and last byte,
// and each number's integer part are folded into the printed checksum.
//
//   build/nish bench/json-tokenizer/main.ts -o build/bench-json/ --link build/bench-json/app
//   build/bench-json/app [rounds]          prints the checksum, then ns per body
//
// bench/json-tokenizer/measure.mjs times it against a byte-identical copy of
// itself for the noise band.
import {
  JSON_TOK_END,
  JSON_TOK_KEY,
  JSON_TOK_NUMBER,
  JSON_TOK_STRING,
  JsonLimits,
  JsonTokenizer,
} from "nish/json-tokenizer"

const BODY: string =
  '{"id":1234567,"user":{"name":"Ada Lovelace","email":"ada@example.com","verified":true},' +
  '"items":[{"sku":"A-100","qty":2,"price":19.99},{"sku":"B-205","qty":1,"price":5.5}],' +
  '"note":"caf\\u00e9 \\ud83d\\ude00 \\"quoted\\"","coupon":null,"total":45.48}'

/** The bytes of `s`. */
const benchBytes = (s: string): u8[] => {
  const n: i32 = toI32(s.length)
  const out = new Array<u8>(n)
  let i: i32 = 0
  while (i < n && i < toI32(out.length)) {
    out[i] = toU8(toI32(s.charCodeAt(i)))
    i += 1
  }
  return out
}

/** One body: every token, folded into a checksum. */
const benchOne = (tok: JsonTokenizer, body: u8[], out: u8[]): i64 => {
  tok.reset(body, 0, toI32(body.length))
  let sum: i64 = 0
  let k: i32 = tok.next()
  while (k > 0) {
    sum = sum * toI64(31) + toI64(k)
    if (k === JSON_TOK_KEY || k === JSON_TOK_STRING) {
      const n: i32 = tok.stringInto(out, 0)
      if (n > 0 && n <= toI32(out.length)) {
        sum = sum + toI64(n) + toI64(out[n - 1])
      }
      if (tok.keyEquals("total")) {
        sum = sum + toI64(7)
      }
    } else if (k === JSON_TOK_NUMBER) {
      sum = sum + toI64(tok.numberF64())
    }
    sum = sum % toI64(1000000007)
    k = tok.next()
  }
  return k === JSON_TOK_END ? sum : toI64(-1)
}

export const main = (): number => {
  const rounds: i32 = process.argv.length > 1 ? toI32(parseInt(process.argv[1])) : 200000
  const body = benchBytes(BODY)
  const out = new Array<u8>(toI32(body.length))
  const tok = new JsonTokenizer(body, 0, toI32(body.length), new JsonLimits())
  // The digit that changes: the last of the id.
  const at: i32 = 12
  let checksum: i64 = 0
  const started: i64 = monotonicNanos()
  let r: i32 = 0
  while (r < rounds) {
    if (at < toI32(body.length)) {
      body[at] = toU8(48 + (r % 10))
    }
    checksum = (checksum + benchOne(tok, body, out)) % toI64(1000000007)
    r += 1
  }
  const elapsed: i64 = monotonicNanos() - started
  console.log(`${checksum}`)
  console.log(`${toF64(elapsed) / toF64(rounds)} ns/body, ${body.length} bytes`)
  return 0
}
