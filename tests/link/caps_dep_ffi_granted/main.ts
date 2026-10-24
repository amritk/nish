// WP40: the same dependency, granted `ffi` by the root package, compiles.
import { magnitude } from "pkg_c";

export const main = (): i32 => {
  const n: i64 = -3;
  return toI32(magnitude(n));
};
