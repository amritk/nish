// The `nish/net/tls-client` handshake under `--number-mode f64` (see `args`):
// every check in `tests/link/net_tls_client`, unchanged, so the handshakes and
// every refusal mean the same thing in both modes.
import { clientChecks } from "../net_tls_client/checks";

export const main = (): i32 => clientChecks();
