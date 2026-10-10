// Wycheproof's HMAC vectors through `nish/crypto/hmac`, in the default number
// mode. The checks are in `checks.ts`, so that
// `tests/link/crypto_hmac_wycheproof_f64` runs the same ones under
// `--number-mode f64`.
import { hmacWycheproofChecks } from "./checks";

export const main = (): i32 => hmacWycheproofChecks();
