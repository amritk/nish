// `tests/link/net_tls_memory` under `--number-mode f64` (see `args`): the same
// thousand-handshake runs, unchanged.
import { memoryChecks } from "../net_tls_memory/checks";

export const main = (): i32 => memoryChecks();
