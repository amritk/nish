// JSON value trees (std/json-value.ts) under an instruction count, grown from
// empty: about 2 MiB of generated records, 20,000 members of one object, parsed
// `n` times by `parseText` and `n` times by `parseTextRanged`, each parse into
// a fresh `JsonDocument`, so every round pays the growth of the value arrays
// from nothing (the regrowth #2449 made one `new Array` per step). It reaches
// the tokenizer and the tree builder whose panic sites the std/ ratchet
// counts, so a fix to one of them shows here as a count that holds or falls.
// It prints the text's length and the sum of the roots' member counts.
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDocument } from "nish/json-value"

const RECORDS: i32 = 20000

const generate = (): string => {
  const parts: string[] = []
  parts.push("{")
  for (let i: i32 = 0; i < RECORDS; i++) {
    if (i > 0) {
      parts.push(",")
    }
    parts.push(
      `"op${i}":{"operationId":"get${i}","tags":["t${i % 7}"],"description":"record ${i} of the generated document","n":${i}}`
    )
  }
  parts.push("}")
  return parts.join("")
}

/** One parse into a fresh document: its root's member count, or -1 when it failed. */
const parseOnce = (text: string, ranged: boolean): i32 => {
  const doc = new JsonDocument(new JsonLimits())
  doc.maxValues = 4194304
  const root = ranged ? doc.parseTextRanged(text) : doc.parseText(text)
  if (root < 0) {
    console.log(`failed ${doc.failed}`)
    return -1
  }
  return doc.length(root)
}

export const main = (): i32 => {
  const n: i32 = 1 // bench:n
  const text = generate()
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    const plain = parseOnce(text, false)
    const ranged = parseOnce(text, true)
    if (plain < 0 || ranged < 0) {
      return 1
    }
    sum += toI64(plain) + toI64(ranged)
  }
  console.log(`${text.length} ${sum}`)
  return 0
}
