// NL2298: one definition per instantiation, in the module that declares the
// template, is the whole-program half of WP18 and has not landed — so a
// template may be imported by name only to be refused by name. It is also why
// the package prefix an instantiation carries is the declaring module's: the
// module that instantiates is the module that declared.
import { identity } from "./wordings_generic";

export const main = (): i32 => identity(1);
