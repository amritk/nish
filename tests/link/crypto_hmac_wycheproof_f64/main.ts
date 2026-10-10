// Wycheproof's HMAC vectors under `--number-mode f64` (see `args`). A `std/`
// module has to compute the same thing in both modes (docs/wp26-stdlib.md §4),
// so every check in `tests/link/crypto_hmac_wycheproof` is run again here,
// unchanged.
import { hmacWycheproofChecks } from "../crypto_hmac_wycheproof/checks";

export const main = (): i32 => hmacWycheproofChecks();
