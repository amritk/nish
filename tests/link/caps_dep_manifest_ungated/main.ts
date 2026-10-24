// WP40: a grant of a capability that is not gated is refused (NL3042): a
// dependency reaches it without one.
import { fetchText } from "pkg_http";

// Never dials: the program has no arguments, so the exit code is 0.
export const main = (): i32 => (process.argv.length > 99 ? fetchText(1) : 0);
