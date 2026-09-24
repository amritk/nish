// `generic_class_clash` after a package: `p` loads first and body-instantiates
// its own `Box<i32>`, then `x.ts` and `y.ts` each declare a `Box<T>` and do the
// same. `x.ts` clashes with `p` (NL3009) and `y.ts` with `x.ts`, inside one
// package, so it is told about `x.ts` (NL3013) rather than about `p` again.
import { p } from "./node_modules/p/index";
import { fx } from "./x";
import { fy } from "./y";

export const main = (): i32 => p() + fx() + fy();
