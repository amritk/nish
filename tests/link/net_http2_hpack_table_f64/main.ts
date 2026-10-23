// `nish/net/hpack`'s dynamic table under `--number-mode f64` (see `args`):
// every check of `tests/link/net_http2_hpack_table` again, in the mode where a
// bare literal is an `f64`.
import { hpackTableChecks } from "../net_http2_hpack_table/checks";

export const main = (): i32 => hpackTableChecks();
