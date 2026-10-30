// `JsonDocument.parse` over one document, ranges off: what every parse costs
// without `keepRanges`, and what a compiler built from before ranges existed
// can build too. bench/json-value/loop.ts is the loop; ranged.ts the same with
// ranges on.
//
//   build/nish bench/json-value/main.ts -o build/bench-json-value/ --link build/bench-json-value/app
//   build/bench-json-value/app <file> <iterations> <at>
import { JsonLimits } from "nish/json-tokenizer"
import { JsonDocument } from "nish/json-value"

import { benchParse } from "./loop"

export const main = (): number => benchParse(new JsonDocument(new JsonLimits()))
