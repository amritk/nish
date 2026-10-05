// `nish/crypto/hmac` and `nish/crypto/hkdf`'s caller-owned scratch under
// `--number-mode f64` (see `args`): every check of
// `tests/link/crypto_hkdf_scratch`, unchanged.
import { hkdfScratchChecks } from "../crypto_hkdf_scratch/checks";

export const main = (): i32 => hkdfScratchChecks();
