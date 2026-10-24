// WP40: the scoped package `@acme/http`, granted `net` by its whole name,
// compiles.
import { fetchText } from "@acme/http";

// Never dials: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText(1) : 0);
