// WP40: `pkg_app` calls `pkg_http`, which reaches `net`, and the root package
// grants `net` to both, so the program compiles.
import { fetchPage } from "pkg_app";

// Never dials: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchPage(1) : 0);
