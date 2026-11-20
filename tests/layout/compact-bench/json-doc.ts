// The JsonTokenizer bench of docs/wp48-ref32-classes.md §5.5: each round
// tokenizes one body with a `JsonTokenizer` made for it and parses another
// into a `JsonDocument` reused across rounds, folding both into a checksum.
// The document holds two `JsonTokenizer` links and the tokenizer is made in
// the loop, so the holder-only rule of #1736 picks `JsonTokenizer` here; the
// stage-3 rule leaves it alone.
//
//   build/nish tests/layout/compact-bench/json-doc.ts --link build/cb-json && build/cb-json <rounds>
import { JSON_TOK_END, JsonLimits, JsonTokenizer } from "nish/json-tokenizer"
import { JsonDocument } from "nish/json-value"

const BODY: string =
  '{"id":1234567,"user":{"name":"Ada Lovelace","email":"ada@example.com","verified":true},' +
  '"items":[{"sku":"A-100","qty":2,"price":19.99},{"sku":"B-205","qty":1,"price":5.5}],' +
  '"note":"plain text","coupon":null,"total":45.48}'

/** The bytes of `s`. */
const benchBytes = (s: string): u8[] => {
  const n: i32 = toI32(s.length)
  const out = new Array<u8>(n)
  for (let i: i32 = 0; i < n && i < toI32(out.length); i += 1) {
    out[i] = toU8(toI32(s.charCodeAt(i)))
  }
  return out
}

export const main = (): number => {
  const rounds: i32 = process.argv.length > 1 ? toI32(parseInt(process.argv[1])) : 1000
  const body = benchBytes(BODY)
  const limits = new JsonLimits()
  const doc = new JsonDocument(limits)
  let checksum: i64 = 0
  for (let i: i32 = 0; i < rounds; i += 1) {
    body[12] = toU8(48 + (i % 10))
    const tok = new JsonTokenizer(body, 0, toI32(body.length), limits)
    let k: i32 = tok.next()
    let tokens: i64 = 0
    while (k > 0) {
      tokens = tokens + toI64(k)
      k = tok.next()
    }
    if (k !== JSON_TOK_END) {
      console.error(`tokenize failed: ${k}`)
      return 1
    }
    const root = doc.parse(body, 0, toI32(body.length))
    if (root < 0) {
      console.error(`parse failed: ${root}`)
      return 1
    }
    const fold: i64 = tokens + toI64(doc.kind(root)) + toI64(doc.length(root)) + toI64(doc.top)
    checksum = (checksum * toI64(31) + fold) % toI64(1000000007)
  }
  console.log(`${checksum}`)
  return 0
}
