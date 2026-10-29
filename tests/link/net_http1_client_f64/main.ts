// `nish/net/http1-client` under `--number-mode f64` (see `args`): every check
// in `tests/link/net_http1_client` again, unchanged, because a `std/` module
// has to mean the same thing in both modes (docs/wp26-stdlib.md §4).
import { http1ClientChecks } from "../net_http1_client/checks";

export const main = (): i32 => http1ClientChecks();
