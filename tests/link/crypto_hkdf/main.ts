// `nish/crypto/hkdf` against RFC 5869's Appendix A and §2.3's length limit, in
// the default number mode. The checks are in `checks.ts`, so that
// `tests/link/crypto_hkdf_f64` runs the same ones under `--number-mode f64`.
import { hkdfChecks } from "./checks";

export const main = (): i32 => hkdfChecks();
