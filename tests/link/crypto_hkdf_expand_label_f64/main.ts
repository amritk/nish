// HKDF-Expand-Label under `--number-mode f64` (see `args`). A `std/` module has
// to compute the same thing in both modes (docs/wp26-stdlib.md §4), and the
// label's bounds compare lengths that are `f64`s in this mode, so every check
// in `tests/link/crypto_hkdf_expand_label` is run again here, unchanged.
import { expandLabelChecks } from "../crypto_hkdf_expand_label/checks";

export const main = (): i32 => expandLabelChecks();
