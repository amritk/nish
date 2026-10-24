// WP40: a dependency cannot grant itself. `pkg_http`'s own manifest allows
// and grants `net`, and is not read: only the root grants, so it is refused.
import { fetchText } from "pkg_http";

// Never dials: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText(1) : 0);
