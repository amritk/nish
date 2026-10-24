// WP40: a dependency that reaches `ffi` the root package does not grant
// it is refused (NL2576), spanned in the dependency and naming the chain.
import { magnitude } from "pkg_c";

export const main = (): i32 => {
  const n: i64 = -3;
  return toI32(magnitude(n));
};
