// WP40 §6: the lockfile records a grant's arguments. It records `pkg_conf`'s
// `fs.read` beneath `./data`; the root package now grants it `./more` too,
// a widening the build refuses (NL2593) until the lock is rewritten.
import { configSize } from "pkg_conf";

// Never reaches it: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? configSize() : 0);
