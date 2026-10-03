// `nish/net/tls-tcp` over loopback under `--number-mode f64`: the checks of
// `tests/link/net_tls_record_tcp`, a Nish client against the carrier in one
// loop, compiled again in the mode where a bare literal is an `f64`.
import { tcpChecks } from "../net_tls_record_tcp/checks";

export const main = (): i32 => tcpChecks();
