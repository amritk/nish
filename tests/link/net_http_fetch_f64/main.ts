// `nish/net/http-client` under `--number-mode f64` (see `args`): every check
// in `tests/link/net_http_fetch` again, unchanged, because a `std/` module
// has to mean the same thing in both modes (docs/wp26-stdlib.md §4).
import { httpFetchChecks } from "../net_http_fetch/checks";

export const main = (): i32 => httpFetchChecks();
