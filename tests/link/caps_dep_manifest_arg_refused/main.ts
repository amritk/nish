// WP40 §2a: a grant argument that resolves to nothing is refused where it is
// written: a host that is not numeric (NL3045), a program not found
// (NL3046), a directory that does not exist (NL3047), and an argument on a
// capability that takes none (NL3048).
import { nothing } from "pkg_any";

// Never reaches it: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? nothing() : 0);
