// `nish/crypto/hmac` under `--number-mode f64` (see `args`). A `std/` module
// has to compute the same thing in both modes (docs/wp26-stdlib.md §4), so
// every check in `tests/link/crypto_hmac` is run again here, unchanged.
import { hmacChecks } from "../crypto_hmac/checks";

export const main = (): i32 => hmacChecks();
