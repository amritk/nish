// WP40 §2a: a program granted `exec:` covers its own literal and no other
// (NL2594), as a plain grant does: `pkg_tool` is granted
// `process.spawn=exec:true` and runs `sh`.
import { work } from "pkg_tool";

// Never reaches it: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? work() : 0);
