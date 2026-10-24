// An `Http3Server`'s ECN across loopback under `--number-mode f64` (see
// `args`): every count and codepoint must stay an integer, so every check of
// `tests/link/net_http3_ecn` is run again, unchanged.
import { ecnChecks } from "../net_http3_ecn/checks";

export const main = (): i32 => ecnChecks();
