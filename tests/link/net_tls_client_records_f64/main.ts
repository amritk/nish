// The `nish/net/tls/record-client` record layer under `--number-mode f64`
// (see `args`): every check in `tests/link/net_tls_client_records`,
// unchanged, so the records and every refusal mean the same thing in both
// modes.
import { recordClientChecks } from "../net_tls_client_records/checks";

export const main = (): i32 => recordClientChecks();
