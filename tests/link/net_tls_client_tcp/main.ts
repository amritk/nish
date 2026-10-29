// `nish/net/tls-tcp-client` in the default number mode. The checks are in
// `checks.ts`, so that `tests/link/net_tls_client_tcp_f64` runs the same ones
// under `--number-mode f64`.
import { tcpClientChecks } from "./checks";

export const main = (): i32 => tcpClientChecks();
