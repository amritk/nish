// `nish/crypto/jwt` against RFC 7515 Appendix A and RFC 8037 A.4, the
// algorithm-confusion and `none` attacks, and each claim check, in the
// default number mode. The checks are in `checks.ts`, so that
// `tests/link/crypto_jwt_f64` runs the same ones under `--number-mode f64`.
import { jwtChecks } from "./checks";

export const main = (): i32 => jwtChecks();
