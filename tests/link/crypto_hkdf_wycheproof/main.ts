// Wycheproof's HKDF vectors through `nish/crypto/hkdf`, in the default number
// mode. The checks are in `checks.ts`, so that
// `tests/link/crypto_hkdf_wycheproof_f64` runs the same ones under
// `--number-mode f64`.
import { hkdfWycheproofChecks } from "./checks";

export const main = (): i32 => hkdfWycheproofChecks();
