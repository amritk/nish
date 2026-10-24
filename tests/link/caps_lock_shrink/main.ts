// WP40: the lockfile records more than `pkg_http` reaches; only growth is an
// error, so the build passes.
import { fetchText } from "pkg_http";

// Never dials: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText(1) : 0);
