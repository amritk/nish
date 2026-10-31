// WP40 §2a: a grant too narrow is refused at build (NL2586): `pkg_http` is
// granted `net` to `127.0.0.1` and dials `10.0.0.1`.
import { fetchText } from "pkg_http";

// Never reaches it: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText() : 0);
