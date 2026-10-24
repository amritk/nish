// WP40: the lockfile records `net` for `pkg_mix`, which also reaches `fs.read`,
// a capability the dependency policy does not gate: the lock refuses it all
// the same (NL2577), so a row is the whole set, not only the gated four.
import { fetchText } from "pkg_mix";

// Never dials or reads: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText(1) : 0);
