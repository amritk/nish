// A production `nish/net/tls` handshake signed with P-256, under
// `--number-mode f64` (see `args`): every check in `tests/link/net_tls_ecdsa`,
// unchanged, so the three suites' handshakes and the DER encoding mean the
// same thing in both modes.
import { ecdsaChecks } from "../net_tls_ecdsa/checks";

export const main = (): i32 => ecdsaChecks();
