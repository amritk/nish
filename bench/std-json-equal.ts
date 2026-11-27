// JSON equality (std/json-equal.ts) under an instruction count: two documents
// that say the same thing in different spellings — members in another order,
// `1.0` for `1`, `1e2` for `100`, `A` for `A` — parsed and compared `n`
// times, with the canonical text, the hash and the duplicate check of each.
// It reaches the tokenizer, the number comparison and the value tree whose
// panic sites the std/ ratchet counts, so a fix to one of them shows here as
// a count that holds or falls. It prints the sum of what it compared.
import { jsonEqual, jsonEqualCanonical, jsonEqualFirstDuplicate, jsonEqualHash } from "nish/json-equal"
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDocument } from "nish/json-value"

/** One record in the first spelling, or in the second when `other`. */
const record = (i: i32, other: boolean): string => {
  if (other) {
    return `{"tags":["\\u0041",${i}e0,null],"score":${i}.50,"id":${i}.0,"ok":${i % 2 === 0},"name":"item-${i}"}`
  }
  return `{"id":${i},"name":"item-${i}","ok":${i % 2 === 0},"score":${i}.5,"tags":["A",${i},null]}`
}

const document = (other: boolean): string => {
  const items: string[] = []
  for (let i: i32 = 0; i < 48; i++) {
    items.push(record(i, other))
  }
  const head = other
    ? `"limit":1e2,"ratio":-0.250e1,"big":12345678901234567890.0`
    : `"big":12345678901234567890,"limit":100,"ratio":-2.5`
  return `{${head},"items":[${items.join(",")}],"empty":{},"none":[]}`
}

export const main = (): i32 => {
  const n: i32 = 300 // bench:n
  const left = document(false)
  const right = document(true)
  const da = new JsonDocument(new JsonLimits())
  const db = new JsonDocument(new JsonLimits())
  let sum: u64 = 0
  for (let round: i32 = 0; round < n; round++) {
    const a = da.parseText(left)
    const b = db.parseText(right)
    if (a < 0 || b < 0) {
      console.log(`failed ${da.failed} ${db.failed}`)
      return 1
    }
    if (!jsonEqual(da, a, db, b)) {
      console.log("not equal")
      return 1
    }
    sum += jsonEqualHash(da, a) ^ jsonEqualHash(db, b)
    sum += toU64(jsonEqualCanonical(da, a).length) + toU64(jsonEqualCanonical(db, b).length)
    sum += toU64(jsonEqualFirstDuplicate(da, a) + 1) + toU64(jsonEqualFirstDuplicate(db, b) + 1)
  }
  console.log(`${sum}`)
  return 0
}
