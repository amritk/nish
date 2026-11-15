// WP40 §2a: `exec:` is read before the program is looked for, so
// `process.spawn=exec:` with nothing after it names no program (NL3046).
import { work } from "pkg_tool";

// Never reaches it: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? work() : 0);
