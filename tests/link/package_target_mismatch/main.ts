// WP89 S6: a package's `nish-wasm32` file is compiled in place of its `nish`
// file by a wasm32 build, so the two must export the same names with the same
// signatures. Here they do not, and the wasm32 build refuses the import with
// NL3063. `package_target_mismatch_native` is the same package built natively,
// which refuses it too.
import { scale } from "pkg_twin";

export const main = (): i32 => scale(3);
