// WP40: a grant's key is decoded as JSON: `pkg\u005fhttp` is `pkg_http`, so
// the grant is honoured.
import { fetchText } from "pkg_http";

// Never dials: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText(1) : 0);
