// WP40: no flag grants a dependency anything. `--allow net` lets the root
// program reach `net`, and `pkg_http` is refused all the same, because only
// the root package's manifest grants a dependency.
import { fetchText } from "pkg_http";

// Never dials: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText(1) : 0);
