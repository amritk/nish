// `nish/crypto/aes`'s `aesKeyInto` in the default number mode. The checks are
// in `checks.ts`, so that `tests/link/crypto_aes_into_f64` runs the same ones
// under `--number-mode f64`.
import { aesIntoChecks } from "./checks";

export const main = (): i32 => aesIntoChecks();
