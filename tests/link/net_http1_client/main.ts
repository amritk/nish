// `nish/net/http1-client` in the default number mode. The checks are in
// `checks.ts`, so that `tests/link/net_http1_client_f64` runs the same ones
// under `--number-mode f64`.
import { http1ClientChecks } from "./checks";

export const main = (): i32 => http1ClientChecks();
