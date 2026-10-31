// WP40 §2a: a grant too narrow is refused at build (NL2586): `pkg_tool` is
// granted `process.spawn` of `true` and runs `sh`.
import { work } from "pkg_tool";

// Never reaches it: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? work() : 0);
