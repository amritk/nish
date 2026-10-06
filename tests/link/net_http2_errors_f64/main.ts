// `nish/net/http2`'s refusals under `--number-mode f64` (see `args`): every
// check of `tests/link/net_http2_errors` again, in the mode where a bare
// literal is an `f64`.
import { errorChecks } from "../net_http2_errors/checks";

export const main = (): i32 => errorChecks();
