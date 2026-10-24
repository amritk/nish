// WP40: `dependencies` that is not an object is refused (NL3041).
import { fetchText } from "pkg_http";

// Never dials: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText(1) : 0);
