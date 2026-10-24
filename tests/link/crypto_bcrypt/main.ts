// `nish/crypto/bcrypt` against crypt_blowfish's vectors and libxcrypt's `$2b$`
// answers, in the default number mode. The checks are in `checks.ts`, so that
// `tests/link/crypto_bcrypt_f64` runs the same ones under `--number-mode f64`.
import { bcryptChecks } from "./checks";

export const main = (): i32 => bcryptChecks();
