// WP40: a dependency that reaches `net` the root package does not grant
// it is refused (NL2576), spanned in the dependency and naming the chain.
import { fetchText } from "pkg_http";

// Never dials: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText(1) : 0);
