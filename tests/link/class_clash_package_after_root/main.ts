// `class_clash_after_package` inside a package: `pa`'s two modules each declare
// a class `Base`, and the program declared one first. `pa/index.ts` clashes
// with this module (NL3009) and `pa/other.ts` with `pa/index.ts` (NL3028).
import { p } from "./node_modules/pa/index";
import { q } from "./node_modules/pa/other";

class Base {
  x: i32 = 7;
}

export const main = (): i32 => new Base().x + p() + q();
