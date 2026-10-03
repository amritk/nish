// `nish/net/tls/record` and `nish/net/tls/record-server` under
// `--number-mode f64`: RFC 8448 §3's records and every refusal, the checks of
// `tests/link/net_tls_record_rfc8448` and `tests/link/net_tls_record_refusals`
// compiled again in the mode where a bare literal is an `f64`.
import { rfc8448RecordChecks } from "../net_tls_record_rfc8448/checks";
import { refusalChecks } from "../net_tls_record_refusals/checks";

export const main = (): i32 => {
  const records: i32 = rfc8448RecordChecks();
  const refusals: i32 = refusalChecks();
  return records !== 0 || refusals !== 0 ? 1 : 0;
};
