// `nish/crypto/hmac` against RFC 4231's test cases, in the default number
// mode. The checks are in `checks.ts`, so that `tests/link/crypto_hmac_f64`
// runs the same ones under `--number-mode f64`.
import { hmacChecks } from "./checks";

export const main = (): i32 => hmacChecks();
