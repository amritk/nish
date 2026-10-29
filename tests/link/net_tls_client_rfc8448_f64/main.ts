// `nish/net/tls-client` against RFC 8448 §3 under `--number-mode f64` (see
// `args`): every check in `tests/link/net_tls_client_rfc8448`, unchanged.
import { clientRfc8448Checks } from "../net_tls_client_rfc8448/checks";

export const main = (): i32 => clientRfc8448Checks();
