// `JsonDocument.parse` over one document, ranges off: what every parse costs,
// and what a compiler built from before ranges existed can build too.
// bench/json-value/loop.ts is the loop; ranged.ts the same with
// `parseRanged`, and both.ts a program that reaches both entry points.
//
//   build/nish bench/json-value/main.ts -o build/bench-json-value/ --link build/bench-json-value/app
//   build/bench-json-value/app <file> <iterations> <at>
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDocument } from "nish/json-value"

import { benchParse } from "./loop"

export const main = (): number =>
  benchParse(new JsonDocument(new JsonLimits()), (doc, src, off, len) => doc.parse(src, off, len))
