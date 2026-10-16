// The HTTP date under `--number-mode f64` (see `args`): every check in
// `tests/link/net_http_date` again, unchanged, because a `std/` module has to
// mean the same thing in both modes (docs/wp26-stdlib.md §4).
import { dateChecks } from "../net_http_date/checks";

export const main = (): i32 => dateChecks();
