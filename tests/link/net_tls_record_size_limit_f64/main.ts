// record_size_limit (RFC 8449) on the TLS server under `--number-mode f64`:
// the checks of `tests/link/net_tls_record_size_limit` compiled again in the
// mode where a bare literal is an `f64`.
import { recordSizeLimitChecks } from "../net_tls_record_size_limit/checks";

export const main = (): i32 => recordSizeLimitChecks();
