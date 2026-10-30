// bench/json-value/main.ts with `parseRanged`: every value's and every key's
// byte range recorded as the document is parsed.
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDocument } from "nish/json-value"

import { benchParse } from "./loop"

export const main = (): number =>
  benchParse(new JsonDocument(new JsonLimits()), (doc, src, off, len) => doc.parseRanged(src, off, len))
