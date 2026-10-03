// Every refusal of `nish/net/tls/record` and `nish/net/tls/record-server`, in
// the default number mode. The checks are in `checks.ts`, so that
// `tests/link/net_tls_record_f64` runs the same ones under `--number-mode f64`.
import { refusalChecks } from "./checks";

export const main = (): i32 => refusalChecks();
