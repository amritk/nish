// WP21 S3: a freestanding wasm32 build has no environment to read, and the
// dependency `pkg_conf` reads it. The refusal is spanned at the program's own
// call and names the package whose code reaches the builtin (NL2404).
import { configSize } from "pkg_conf";

export const size = (): i32 => configSize();
