// WP40 §2a: `fs.write` is gated for a dependency, as `net` is: `pkg_log`
// writes a file, and the root package grants it nothing (NL2576).
import { logOnce } from "pkg_log";

// Never reaches it: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? logOnce() : 0);
