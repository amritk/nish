// `nish/net/hpack`'s dynamic table as `nish/net/http2` decodes with it, in the
// default number mode; the checks are in `checks.ts`, so that
// `tests/link/net_http2_hpack_table_f64` runs the same ones under
// `--number-mode f64`.
import { hpackTableChecks } from "./checks";

export const main = (): i32 => hpackTableChecks();
