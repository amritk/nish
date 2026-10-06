// `nish/net/http2` under `--number-mode f64` (see `args`): every check of
// `tests/link/net_http2` again, in the mode where a bare literal is an `f64`.
import { http2Checks } from "../net_http2/checks";

export const main = (): i32 => http2Checks();
