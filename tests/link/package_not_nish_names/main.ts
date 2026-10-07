// #434: a package whose `exports` offers no `nish` condition, imported with
// three names in one statement. The checker keeps one import binding per
// name, and each used to resolve the package again and report it again, so
// this printed the same error three times and summarised `3 errors`.
// `expected.json` pins exactly one diagnostic, at the specifier.
import { x, y, z } from "dep";

export const main = (): i32 => x + y + z;
