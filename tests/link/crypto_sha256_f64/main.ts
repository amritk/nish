// `nish/crypto/sha256` under `--number-mode f64` (see `args`). A `std/` module
// has to compute the same thing in both modes (docs/wp26-stdlib.md §4), and a
// hash is where a width that silently became an `f64` would show: every vector
// in `tests/link/crypto_sha256` is run again here, unchanged.
import { sha256Checks } from "../crypto_sha256/checks";

export const main = (): i32 => sha256Checks();
