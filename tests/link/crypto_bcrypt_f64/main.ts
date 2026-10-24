// `nish/crypto/bcrypt` under `--number-mode f64` (see `args`). A `std/` module
// has to compute the same thing in both modes, and Blowfish is 32-bit word
// arithmetic that must not become `f64`, so every check in
// `tests/link/crypto_bcrypt` is run again here, unchanged.
import { bcryptChecks } from "../crypto_bcrypt/checks";

export const main = (): i32 => bcryptChecks();
