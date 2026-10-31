// WP40 §2a: a grant too narrow is refused at build (NL2592): `pkg_conf` is
// granted `fs.read` beneath `./data` and names `/etc/passwd`.
import { configSize } from "pkg_conf";

// Never reaches it: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? configSize() : 0);
