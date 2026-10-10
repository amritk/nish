// Wycheproof's HKDF vectors under `--number-mode f64` (see `args`). A `std/`
// module has to compute the same thing in both modes (docs/wp26-stdlib.md §4),
// so every check in `tests/link/crypto_hkdf_wycheproof` is run again here,
// unchanged.
import { hkdfWycheproofChecks } from "../crypto_hkdf_wycheproof/checks";

export const main = (): i32 => hkdfWycheproofChecks();
