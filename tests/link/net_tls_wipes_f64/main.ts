// `tests/link/net_tls_wipes` under `--number-mode f64` (see `args`): the same
// read-backs, unchanged.
import { tlsWipeChecks } from "../net_tls_wipes/checks";

export const main = (): i32 => tlsWipeChecks();
