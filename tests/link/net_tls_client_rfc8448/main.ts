// `nish/net/tls-client` against RFC 8448 §3 in the default number mode. The
// checks are in `checks.ts`, so that `tests/link/net_tls_client_rfc8448_f64`
// runs the same ones under `--number-mode f64`.
import { clientRfc8448Checks } from "./checks";

export const main = (): i32 => clientRfc8448Checks();
