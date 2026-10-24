// `pbkdf2HmacSha256` under `--number-mode f64` (see `args`). A `std/` module
// has to compute the same thing in both modes (docs/wp26-stdlib.md §4), so
// every check in `tests/link/std_pbkdf2` is run again here, unchanged.
import { pbkdf2Checks } from "../std_pbkdf2/checks";

export const main = (): i32 => pbkdf2Checks();
