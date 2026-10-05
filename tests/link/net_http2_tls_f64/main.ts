// `nish/net/http2-tls` over loopback under `--number-mode f64` (see `args`):
// the checks of `tests/link/net_http2_tls`, Nish clients against the carrier
// in one loop, compiled again in the mode where a bare literal is an `f64`.
import { tlsChecks } from "../net_http2_tls/checks";

export const main = (): i32 => tlsChecks();
