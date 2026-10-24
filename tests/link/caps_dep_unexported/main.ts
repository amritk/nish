// WP40: the check judges every function a dependency defines, exported or
// not, called or not: `pkg_quiet` reaches `net` only in `dial`, which nothing
// exports and nothing calls, and it is refused all the same.
import { answer } from "pkg_quiet";

export const main = (): i32 => answer();
