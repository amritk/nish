// `nish/net/http-fields`'s date writer and `nish/net/http1-server`'s
// `HttpDate` in the default number mode. The checks are in `checks.ts`, so
// that `tests/link/net_http_date_f64` runs the same ones under
// `--number-mode f64`.
import { dateChecks } from "./checks";

export const main = (): i32 => dateChecks();
