// WP40: a dependency that calls itself `nish` is a dependency, not the
// standard library -- what decides is where its module was resolved -- so its
// `net` is refused like any other's.
import { fetchText } from "nish";

export const main = (): i32 => (process.argv.length > 99 ? fetchText(1) : 0);
