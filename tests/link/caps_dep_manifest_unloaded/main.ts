// WP40: a grant may name a package the program does not load: it grants
// nothing, and refuses nothing.
import { fetchText } from "pkg_http";

// Never dials: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText(1) : 0);
