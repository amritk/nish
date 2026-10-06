// `nish/net/http-fields` under `--number-mode f64` (see `args`). A `std/`
// module has to compute the same thing in both modes (docs/wp26-stdlib.md §4),
// so every check in `tests/link/net_http_fields` is run again here, unchanged.
import { fieldsChecks } from "../net_http_fields/checks";

export const main = (): i32 => fieldsChecks();
