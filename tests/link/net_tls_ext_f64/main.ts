// The extension, HelloRetryRequest and refusal checks of `nish/net/tls` under
// `--number-mode f64` (see `args`): every check of `net_tls_ext_alpn`,
// `net_tls_ext_sni`, `net_tls_ext_quic`, `net_tls_ext_hrr` and
// `net_tls_ext_refusals`, unchanged, since every length, offset and alert in
// the handshake is `i32` arithmetic that must not become an `f64`. The exit
// code is the number of suites that failed.
import { alpnChecks } from "../net_tls_ext_alpn/checks";
import { quicChecks } from "../net_tls_ext_quic/checks";
import { refusalChecks } from "../net_tls_ext_refusals/checks";
import { retryChecks } from "../net_tls_ext_hrr/checks";
import { sniChecks } from "../net_tls_ext_sni/checks";

export const main = (): i32 => alpnChecks() + sniChecks() + quicChecks() + retryChecks() + refusalChecks();
