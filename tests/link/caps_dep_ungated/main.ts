// WP40: a dependency reaches every capability but the four gated ones
// without a grant: `pkg_env` reads the environment and a file, and the root
// package grants it nothing. The exit code is 5.
import { five } from "pkg_env";

export const main = (): i32 => five();
