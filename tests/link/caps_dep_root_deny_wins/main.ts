// WP40: a grant never widens the root package's own policy. `pkg_http` is
// granted `net`, the root package denies it, and `main`, which reaches it
// through the dependency, is refused by the policy (NL2459).
import { fetchText } from "pkg_http";

// Never dials: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText(1) : 0);
