// `nish/net/qpack` under `--number-mode f64` (see `args`). A `std/` module has
// to compute the same thing in both modes (docs/wp26-stdlib.md §4), and the
// codec compares lengths that are `f64`s in this mode, so every check in
// `tests/link/net_qpack` is run again here, unchanged.
import { qpackChecks } from "../net_qpack/checks";

export const main = (): i32 => qpackChecks();
