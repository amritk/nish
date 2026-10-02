// HKDF-Expand-Label against RFC 8448 §3 and RFC 9001 A.1, in the default
// number mode. The checks are in `checks.ts`, so that
// `tests/link/crypto_hkdf_expand_label_f64` runs the same ones under
// `--number-mode f64`.
import { expandLabelChecks } from "./checks";

export const main = (): i32 => expandLabelChecks();
