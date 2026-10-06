// `nish/net/http1-server` over loopback under `--number-mode f64` (see
// `args`): the checks of `tests/link/net_http1_server`, compiled again in the
// mode where a bare literal is an `f64`.
import { serverChecks } from "../net_http1_server/checks";

export const main = (): i32 => serverChecks();
