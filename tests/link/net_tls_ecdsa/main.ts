// A production `nish/net/tls` handshake signed with P-256, in the default
// number mode. The checks are in `checks.ts`, so that
// `tests/link/net_tls_ecdsa_f64` runs the same ones under `--number-mode f64`.
import { ecdsaChecks } from "./checks";

export const main = (): i32 => ecdsaChecks();
