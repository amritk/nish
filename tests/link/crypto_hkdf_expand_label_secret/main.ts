// HKDF-Expand-Label on a secret held as a `Secret`, in the default number mode.
// The checks are in `checks.ts`, so that
// `tests/link/crypto_hkdf_expand_label_secret_f64` runs the same ones under
// `--number-mode f64`.
import { expandLabelSecretChecks } from "./checks";

export const main = (): i32 => expandLabelSecretChecks();
