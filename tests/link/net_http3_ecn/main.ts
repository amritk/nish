// ECN across loopback between a client and `nish/net/http3-server`: the
// checks of `checks.ts`, also run under `--number-mode f64` by
// `tests/link/net_http3_ecn_f64`.
import { ecnChecks } from "./checks";

export const main = (): i32 => ecnChecks();
