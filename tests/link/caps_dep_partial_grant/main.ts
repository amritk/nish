// WP40: a grant is of the capabilities it names and no others. `pkg_b` is
// granted `net` and reaches `net` and `unsafe`: it is refused for `unsafe`
// alone (NL2576), and its granted `net` is no error.
import { fetchMixed } from "pkg_b";

export const main = (): i32 => (process.argv.length > 99 ? fetchMixed(1) : 0);
