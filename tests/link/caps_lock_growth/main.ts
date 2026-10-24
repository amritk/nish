// WP40: the lockfile records nothing for `pkg_http`, which reaches `net`, so the
// build is refused (NL2577), spanned in the dependency and naming the chain.
import { fetchText } from "pkg_http";

// Never dials: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText(1) : 0);
