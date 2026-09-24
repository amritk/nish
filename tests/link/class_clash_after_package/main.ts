// Two modules of the program's own package each declare a class `Base`, and a
// package `pa` declared one before either of them. `a.ts` clashes with `pa`
// (NL3009); `b.ts` clashes with `a.ts` inside one package (NL3028), and is
// refused for the name once rather than again for the constructor the two
// share, which is what comparing it with `pa`'s declaration alone used to do.
import { p } from "./node_modules/pa/index";
import { fa } from "./a";
import { fb } from "./b";

export const main = (): i32 => p() + fa() + fb();
