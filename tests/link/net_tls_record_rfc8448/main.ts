// `nish/net/tls/record` and `nish/net/tls/record-server` against RFC 8448 §3
// in the default number mode. The checks are in `checks.ts`, so that
// `tests/link/net_tls_record_f64` runs the same ones under `--number-mode f64`.
import { rfc8448RecordChecks } from "./checks";

export const main = (): i32 => rfc8448RecordChecks();
