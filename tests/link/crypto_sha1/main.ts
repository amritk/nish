// `nish/crypto/sha1` against the FIPS 180-4 examples, in the default number
// mode. The checks are in `checks.ts`, so that `tests/link/crypto_sha1_f64`
// runs the same ones under `--number-mode f64`.
import { sha1Checks } from "./checks";

export const main = (): i32 => sha1Checks();
