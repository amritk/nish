// WP34 N6: the constant-time builtins are globals, like `Math` and the width
// conversions, because they lower to instructions and call no runtime; there is
// no `nish:ct` module to import them from.
import { ctEq } from "nish:ct";
export const same = (a: u32, b: u32): u32 => ctEq(a, b);
