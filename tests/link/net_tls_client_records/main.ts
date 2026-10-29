// `nish/net/tls/record-client` in the default number mode. The checks are in
// `checks.ts`, so that `tests/link/net_tls_client_records_f64` runs the same
// ones under `--number-mode f64`.
import { recordClientChecks } from "./checks";

export const main = (): i32 => recordClientChecks();
