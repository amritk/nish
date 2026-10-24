// WP40: the lockfile keeps a row for a dependency the program no longer has; a
// stale row is accepted.
import { fetchText } from "pkg_http";

// Never dials: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText(1) : 0);
