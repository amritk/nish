// `JsonDocument`'s builders with ranges off: every iteration clears the
// document and builds an object of 100 arrays of 10 numbers each through
// `newObject`, `newArray`, `newI64`, `push` and `set`, then sets every key a
// second time, which replaces the value in place. What a program that writes a
// document rather than parsing one pays, and what a compiler built from before
// ranges existed can build too.
//
//   build/nish bench/json-value/builders.ts -o build/bench-json-value/ --link build/bench-json-value/builders
//   build/bench-json-value/builders <iterations>
//
// The first line printed is a checksum of the document's counts and its root's
// length after every iteration, the second `ns <elapsed>` for every iteration
// together.
import { JsonLimits } from "nish/json-tokenizer"
import { JSON_VALUE_MAX_VALUES, JsonDocument } from "nish/json-value"

const MEMBERS: i32 = 100
const ELEMENTS: i32 = 10

export const main = (): number => {
  if (process.argv.length < 2) {
    console.error("usage: builders <iterations>")
    return 2
  }
  const iterations: i32 = toI32(parseInt(process.argv[1]))
  const keys: string[] = []
  for (let k: i32 = 0; k < MEMBERS; k += 1) {
    keys.push(`member${k}`)
  }
  const doc = new JsonDocument(new JsonLimits())
  doc.maxValues = JSON_VALUE_MAX_VALUES
  let checksum: i64 = 0
  const t0: i64 = monotonicNanos()
  for (let i: i32 = 0; i < iterations; i += 1) {
    doc.clear()
    const root = doc.newObject()
    for (let k: i32 = 0; k < toI32(keys.length); k += 1) {
      const key: string = keys[k]
      const a = doc.newArray()
      for (let j: i32 = 0; j < ELEMENTS; j += 1) {
        if (doc.push(a, doc.newI64(toI64(i + k * ELEMENTS + j))) !== 0) {
          console.error("push failed")
          return 1
        }
      }
      if (doc.set(root, key, a) !== 0) {
        console.error("set failed")
        return 1
      }
    }
    for (let k: i32 = 0; k < toI32(keys.length); k += 1) {
      if (doc.set(root, keys[k], doc.newBoolean(k % 2 === 0)) !== 0) {
        console.error("set failed")
        return 1
      }
    }
    const fold: i64 = toI64(doc.length(root)) + toI64(doc.top) + toI64(doc.slotTop) + toI64(doc.byteTop)
    checksum = (checksum * toI64(31) + fold) % toI64(1000000007)
  }
  const elapsed: i64 = monotonicNanos() - t0
  console.log(`${checksum}`)
  console.log(`ns ${elapsed}`)
  return 0
}
