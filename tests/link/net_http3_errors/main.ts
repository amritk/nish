// `nish/net/http3`'s connection errors in the default number mode, each
// reached by a negative case and each asserting its exact code. The checks are
// in `checks.ts`, so that `tests/link/net_http3_errors_f64` runs the same ones
// under `--number-mode f64`.
import { errorChecks } from "./checks";

export const main = (): i32 => errorChecks();
