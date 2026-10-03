// `nish/net/quic-listener` and the lifecycle half of `nish/net/quic` under
// `--number-mode f64` (see `args`): every time, token field, packet number
// and reset length must stay an integer, so every check of
// `tests/link/net_quic_lifecycle` is run again, unchanged.
import { quicLifecycleChecks } from "../net_quic_lifecycle/checks";

export const main = (): i32 => quicLifecycleChecks();
