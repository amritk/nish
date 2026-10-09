// #434, the same repeat on the relative-module path: two names imported from
// a file that is not there are one "Cannot find module", not two.
// `expected.json` pins exactly one diagnostic, at the specifier.
import { square, cube } from "./nope";

export const main = (): i32 => square(2) + cube(2);
