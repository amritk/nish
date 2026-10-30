// bench/json-value/main.ts with `keepRanges` on: every value's and every key's
// byte range recorded as the document is parsed.
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDocument } from "nish/json-value"

import { benchParse } from "./loop"

export const main = (): number => {
  const doc = new JsonDocument(new JsonLimits())
  doc.keepRanges = true
  return benchParse(doc)
}
