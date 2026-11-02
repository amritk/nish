// WP40 §2a: a grant too narrow is refused at build (NL2594): `pkg_log` is
// granted `fs.write` beneath `./out` and names `/tmp/nish-caps.log`.
import { logLine } from "pkg_log";

// Never reaches it: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? logLine() : 0);
