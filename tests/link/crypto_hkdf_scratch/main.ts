// `nish/crypto/hmac` and `nish/crypto/hkdf`'s caller-owned scratch in the
// default number mode. The checks are in `checks.ts`, so that
// `tests/link/crypto_hkdf_scratch_f64` runs the same ones under
// `--number-mode f64`.
import { hkdfScratchChecks } from "./checks";

export const main = (): i32 => hkdfScratchChecks();
