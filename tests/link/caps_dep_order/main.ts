// WP40: one NL2576 per package and capability it is refused, each at its own
// witness and printed by position like every diagnostic: `pkg_a`'s `ffi`, then
// `pkg_b`'s `unsafe` in `mix` and its `net` in `both`, below it.
import { both } from "pkg_b";
import { magnitude } from "pkg_a";

export const main = (): i32 => (process.argv.length > 99 ? both(1) + toI32(magnitude(1)) : 0);
