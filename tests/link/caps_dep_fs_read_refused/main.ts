// WP40 §2a: `fs.read` is gated for a dependency, as `net` is: `pkg_conf`
// reads a file, and the root package grants it nothing (NL2576).
import { configSize } from "pkg_conf";

// Never reaches it: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? configSize() : 0);
