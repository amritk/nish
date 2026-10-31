// WP40 §2a: a socket-path grant too narrow is refused at build (NL2592):
// `pkg_http` is granted `net` to `/run/app.sock` and connects to
// `/run/other.sock`.
import { fetchText } from "pkg_http";

// Never reaches it: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText() : 0);
