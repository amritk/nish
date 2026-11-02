// WP40 §2a: a `net` grant naming a Unix socket's absolute path covers a
// literal `unixConnect` of that path, so the build is accepted.
import { fetchText } from "pkg_http";

// Never reaches it: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText() : 0);
