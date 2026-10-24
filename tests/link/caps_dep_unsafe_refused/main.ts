// WP40: a dependency that reaches `unsafe` the root package does not grant
// it is refused (NL2576), spanned in the dependency and naming the chain.
import { mix } from "pkg_fast";

export const main = (): i32 => mix(7) + 4;
