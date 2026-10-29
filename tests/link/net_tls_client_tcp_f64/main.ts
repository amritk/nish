// `nish/net/tls-tcp-client` under `--number-mode f64`: the checks of
// `tests/link/net_tls_client_tcp`, where a bare literal is an `f64`.
import { tcpClientChecks } from "../net_tls_client_tcp/checks";

export const main = (): i32 => tcpClientChecks();
