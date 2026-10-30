// nish/net/http-client in the default number mode. The checks are in
// `checks.ts`, so that `tests/link/net_http_fetch_f64` runs the same ones
// under `--number-mode f64`.
import { httpFetchChecks } from "./checks";

export const main = (): i32 => httpFetchChecks();
