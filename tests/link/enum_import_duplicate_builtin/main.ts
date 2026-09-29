// A builtin imported under the name an enum import took is the duplicate too:
// the enum is bound before any builtin, so the builtin is the second binding.
import { Kind } from "./kinds";
import { readFileSync as Kind } from "nish:fs";

export const main = (): number => 0;
