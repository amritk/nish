// `nish/net/http3-server` under `--number-mode f64` (see `args`): the index,
// the wheel and the carrier across loopback, every check of
// `tests/link/net_http3_server` again, unchanged.
import { serverChecks } from "../net_http3_server/checks";

export const main = (): i32 => serverChecks();
