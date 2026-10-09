// `nish/net/quic-listener`'s window form under `--number-mode f64` (see
// `args`): every check of `tests/link/net_quic_listener` again, unchanged.
import { listenerChecks } from "../net_quic_listener/checks";

export const main = (): i32 => listenerChecks();
