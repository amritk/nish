// JSON value trees (std/json-value.ts) under an instruction count, reused:
// the same generated records as std-json-value-parse, parsed `n` times into
// one `JsonDocument`, which starts empty and grows once on the first parse,
// so later rounds measure a parse into arrays that are already big enough.
// Beside std-json-value-parse it separates what growth costs from what a
// parse costs. It prints the text's length and the sum of the roots' member
// counts.
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

export const main = (): i32 => {
  const n: i32 = 2 // bench:n
  const text = generate()
  const doc = new JsonDocument(new JsonLimits())
  doc.maxValues = 4194304
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    const root = doc.parseText(text)
    if (root < 0) {
      console.log(`failed ${doc.failed}`)
      return 1
    }
    sum += toI64(doc.length(root))
  }
  console.log(`${text.length} ${sum}`)
  return 0
}
