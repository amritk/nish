// `nish/net/http3`'s connection errors under `--number-mode f64` (see `args`):
// every check of `tests/link/net_http3_errors` again, unchanged.
import { errorChecks } from "../net_http3_errors/checks";

export const main = (): i32 => errorChecks();
