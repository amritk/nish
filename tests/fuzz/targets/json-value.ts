/**
 * Fuzz target: `JsonDocument.parse` (std/json-value.ts), its readers, and
 * the round trip through `stringify`.
 *
 * Byte 0 picks the mode and the rest is the text, the window `[1, n)` of
 * `data`. Bit 0 keeps the last of a repeated key instead of refusing it;
 * bit 1 caps the document at 16 values, so `JSON_VALUE_ERR_VALUES` runs on
 * short inputs. A document that parses is walked through every reader (a
 * number through `numberText`, `isIntegral`, `isI64`/`i64`, `isU64`/`u64`
 * and `f64`, checked against each other), and
 * written back: the text it writes must parse again, to a document that
 * writes the same text. A refusal is `failed`; a panic, or a round trip
 * that disagrees, is a crash, and so is `JSON_VALUE_ERR_ATTACHED` from
 * `parse`, which only building calls answer.
 */
import { JsonLimits } from "nish/json-tokenizer"
import {
  JSON_VALUE_ARRAY,
  JSON_VALUE_BOOLEAN,
  JSON_VALUE_DUPLICATE_LAST,
  JSON_VALUE_ERR_ATTACHED,
  JSON_VALUE_NONE,
  JSON_VALUE_NUMBER,
  JSON_VALUE_OBJECT,
  JSON_VALUE_STRING,
  JsonDocument,
  JsonValue,
} from "nish/json-value"

const walk = (doc: JsonDocument, v: JsonValue): void => {
  const kind: i32 = doc.kind(v)
  if (kind === JSON_VALUE_NONE) {
    panic("json-value: a value of a parsed document has no kind")
  }
  if (kind === JSON_VALUE_BOOLEAN) {
    doc.boolean(v)
  } else if (kind === JSON_VALUE_NUMBER) {
    if (doc.numberText(v) === "") {
      panic("json-value: a number has no text")
    }
    const integral: boolean = doc.isIntegral(v)
    if (doc.isI64(v)) {
      doc.i64(v)
      if (!integral) {
        panic("json-value: an i64 is not integral")
      }
    } else if (doc.i64(v) !== toI64(0)) {
      panic("json-value: i64 of a number that is not one is not 0")
    }
    if (doc.isU64(v)) {
      doc.u64(v)
      if (!integral) {
        panic("json-value: a u64 is not integral")
      }
    } else if (doc.u64(v) !== toU64(0)) {
      panic("json-value: u64 of a number that is not one is not 0")
    }
    doc.f64(v)
  } else if (kind === JSON_VALUE_STRING) {
    const s: string = doc.string(v)
    if (!doc.stringEquals(v, s)) {
      panic("json-value: a string does not equal itself")
    }
  } else if (kind === JSON_VALUE_ARRAY || kind === JSON_VALUE_OBJECT) {
    const n: i32 = doc.length(v)
    let i: i32 = 0
    while (i < n) {
      const child: JsonValue = doc.at(v, i)
      if (kind === JSON_VALUE_OBJECT) {
        const key: string = doc.keyAt(v, i)
        if (doc.kind(doc.get(v, key)) === JSON_VALUE_NONE) {
          panic("json-value: get misses a key keyAt names")
        }
      }
      walk(doc, child)
      i += 1
    }
  }
}

export const fuzzOne = (data: u8[]): void => {
  const n: i32 = toI32(data.length)
  if (n === 0) {
    return
  }
  const mode: i32 = toI32(data[0])
  const doc: JsonDocument = new JsonDocument(new JsonLimits())
  if ((mode & 1) !== 0) {
    doc.duplicates = JSON_VALUE_DUPLICATE_LAST
  }
  if ((mode & 2) !== 0) {
    doc.maxValues = 16
  }
  const root: JsonValue = doc.parse(data, 1, n - 1)
  if (doc.failed === JSON_VALUE_ERR_ATTACHED) {
    panic("json-value: parse answered JSON_VALUE_ERR_ATTACHED")
  }
  if (doc.failed !== 0) {
    return
  }
  walk(doc, root)
  const text: string = doc.stringify(root)
  if (text === "") {
    panic("json-value: a parsed document did not write back")
  }
  const again: JsonDocument = new JsonDocument(new JsonLimits())
  const root2: JsonValue = again.parseText(text)
  if (again.failed !== 0) {
    panic(`json-value: the written text does not parse (${again.failed}): ${text}`)
  }
  if (again.stringify(root2) !== text) {
    panic(`json-value: the round trip is not stable: ${text}`)
  }
}
