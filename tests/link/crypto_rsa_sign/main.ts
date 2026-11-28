// `nish/crypto/rsa-sign` against Wycheproof keys and known answers; the checks
// are in checks.ts, which `crypto_rsa_sign_f64` runs again under
// `--number-mode f64`.
import { rsaSignChecks } from "./checks";

export const main = (): i32 => rsaSignChecks();
