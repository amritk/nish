// JSON value trees (std/json-value.ts) under an instruction count, read: one
// generated document of 4,000 records, parsed once with ranges, then walked
// `n` times over every node, by `at` and `keyAt` down each object and array,
// by `get` for one member of each record, and by `string`, `keyStart` and
// `start` on what it finds. It reaches the readers whose panic sites the std/
// ratchet counts, so a fix to one of them shows here as a count that holds or
// falls. It prints the sum of the lengths and offsets it read.
import { JsonLimits } from "nish/json-tokenizer"
import { JSON_VALUE_ARRAY, JSON_VALUE_OBJECT, JSON_VALUE_STRING, JsonDocument, JsonValue } from "nish/json-value"

const RECORDS: i32 = 4000

const generate = (): string => {
  const parts: string[] = []
  parts.push("{")
  for (let i: i32 = 0; i < RECORDS; i++) {
    if (i > 0) {
      parts.push(",")
    }
    parts.push(
      `"op${i}":{"operationId":"get${i}","tags":["t${i % 7}","u${i % 3}"],"description":"record ${i}","n":${i}}`
    )
  }
  parts.push("}")
  return parts.join("")
}

/** Every node under `v`: the sum of its strings' and keys' lengths and of their offsets. */
const walk = (doc: JsonDocument, v: JsonValue): i64 => {
  let sum: i64 = toI64(doc.start(v))
  const kind: i32 = doc.kind(v)
  if (kind === JSON_VALUE_STRING) {
    sum += toI64(doc.string(v).length)
  } else if (kind === JSON_VALUE_OBJECT) {
    const count: i32 = doc.length(v)
    for (let i: i32 = 0; i < count; i++) {
      sum += toI64(doc.keyAt(v, i).length) + toI64(doc.keyStart(v, i))
      sum += walk(doc, doc.at(v, i))
    }
    const id = doc.get(v, "operationId")
    if (id >= 0) {
      sum += toI64(doc.string(id).length)
    }
  } else if (kind === JSON_VALUE_ARRAY) {
    const count: i32 = doc.length(v)
    for (let i: i32 = 0; i < count; i++) {
      sum += walk(doc, doc.at(v, i))
    }
  }
  return sum
}

export const main = (): i32 => {
  const n: i32 = 20 // bench:n
  const text = generate()
  const doc = new JsonDocument(new JsonLimits())
  doc.maxValues = 4194304
  const root = doc.parseTextRanged(text)
  if (root < 0) {
    console.log(`failed ${doc.failed}`)
    return 1
  }
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    sum += walk(doc, root)
  }
  console.log(`${sum}`)
  return 0
}
