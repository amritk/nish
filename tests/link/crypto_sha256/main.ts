// `nish/crypto/sha256` against the FIPS 180-4 and NIST CAVP vectors, in the
// default number mode. The checks are in `checks.ts`, so that
// `tests/link/crypto_sha256_f64` runs the same ones under `--number-mode f64`.
import { sha256Checks } from "./checks";

export const main = (): i32 => sha256Checks();
