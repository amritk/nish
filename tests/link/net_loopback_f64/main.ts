// The loopback suite under `--number-mode f64` (see `args`): the checks of
// `tests/link/net_loopback`, every carrier, compiled again in the mode where a
// bare literal is an `f64`.
import { loopbackChecks } from "../net_loopback/checks";

export const main = (): i32 => loopbackChecks();
