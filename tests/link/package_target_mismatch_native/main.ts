// WP89 S6: the native build of `package_target_mismatch`. It never compiles
// the package's `nish-wasm32` file, and still refuses the pair with NL3063,
// so a package whose two files drift fails in the build its author runs, not
// only in the one a wasm32 user does.
import { scale } from "pkg_twin";

export const main = (): i32 => scale(3);
