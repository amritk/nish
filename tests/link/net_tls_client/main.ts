// `nish/net/tls-client` in the default number mode. The checks are in
// `checks.ts`, so that `tests/link/net_tls_client_f64` runs the same ones
// under `--number-mode f64`.
import { clientChecks } from "./checks";

export const main = (): i32 => clientChecks();
