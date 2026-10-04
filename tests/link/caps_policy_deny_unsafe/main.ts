// `--deny unsafe` refuses a program that gives up a check anywhere in its
// closure: a call to a `nish:unsafe` export carries the `unsafe` capability
// like any other, through every caller (NL2459).
import { first } from "./fast";

export const main = (): number => first([3, 4]);
