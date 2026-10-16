// HKDF-Expand-Label on a `Secret` under `--number-mode f64` (see `args`): every
// check in `tests/link/crypto_hkdf_expand_label_secret`, run again unchanged.
import { expandLabelSecretChecks } from "../crypto_hkdf_expand_label_secret/checks";

export const main = (): i32 => expandLabelSecretChecks();
