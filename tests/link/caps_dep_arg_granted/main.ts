// WP40 §2a: a grant with arguments. `pkg_tool` is granted `fs.read` beneath
// `./data`, `process.spawn` of `true` and `net` to `127.0.0.1`, and every
// literal it hands those builtins is one the grant covers, so it compiles.
import { work } from "pkg_tool";

// Never reaches it: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? work() : 0);
