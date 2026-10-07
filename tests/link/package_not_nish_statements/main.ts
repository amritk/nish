// #434, the other half: two `import` statements of a package whose `exports`
// offers no `nish` condition are two diagnostics, one at each specifier. The
// repeat that #434 removed was per name; a statement is still reported on its own.
// `expected.json` pins exactly two.
import { x, y } from "dep";
import { z } from "dep";

export const main = (): i32 => x + y + z;
