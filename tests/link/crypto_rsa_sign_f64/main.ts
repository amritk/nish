// `nish/crypto/rsa-sign` under `--number-mode f64` (see `args`). A `std/`
// module has to compute the same thing in both modes (docs/wp26-stdlib.md §4):
// every check of `tests/link/crypto_rsa_sign` is run again here, unchanged.
import { rsaSignChecks } from "../crypto_rsa_sign/checks";

export const main = (): i32 => rsaSignChecks();
