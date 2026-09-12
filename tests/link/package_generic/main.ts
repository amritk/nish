// WP18 + WP21 S1: a generic instantiated inside a package carries that
// package's symbol prefix, so three modules may each declare `pick<T>` and each
// get its own `define`.
//
// This is not covered by the symbol scoping alone. `Checker.qualifySymbols`
// walks `program.functions` at the end of pass 1, and an instantiation is
// appended during pass 2 — after that walk has run — so an instantiation never
// passes through it. The prefix has to be part of the mangled symbol from the
// moment it is minted, and this program is what says it is: the three `define`s
// must be `@pick$i32`, `@pkg_a.pick$i32` and `@pkg_b.pick$i32`. Without the
// prefix they collide, and the whole-program fact table in
// `codegen/attributes.ts` — which is keyed by symbol — would hand one
// instantiation another's purity and escape facts.
//
// The arithmetic is the assertion, and it is built to tell the three apart
// rather than merely to run: this `pick` answers its *first* argument, pkg_a's
// answers its *second*, and pkg_b's answers its first again, with arguments
// chosen so that every wrong pairing gives a different exit code. 10 + 7 + 40
// is 57; the root's body used throughout would be 10 + 3 + 40 = 53, pkg_a's
// throughout would be 20 + 7 + 1 = 28.
import { chooseA } from "./node_modules/pkg_a/index";
import { chooseB } from "./node_modules/pkg_b/index";

const pick = <T>(a: T, b: T): T => a;

export const main = (): i32 => pick(10, 20) + chooseA() + chooseB();
