// `nish/crypto/hkdf` under `--number-mode f64` (see `args`). A `std/` module
// has to compute the same thing in both modes (docs/wp26-stdlib.md §4), and
// the length limit is arithmetic on an `i32` that must not become an `f64`, so
// every check in `tests/link/crypto_hkdf` is run again here, unchanged.
import { hkdfChecks } from "../crypto_hkdf/checks";

export const main = (): i32 => hkdfChecks();
