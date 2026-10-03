// `nish/net/http1` under `--number-mode f64` (see `args`): every check in
// `tests/link/net_http1` again, unchanged, because a `std/` module has to
// mean the same thing in both modes (docs/wp26-stdlib.md §4).
import { http1Checks } from "../net_http1/checks";

export const main = (): i32 => http1Checks();
