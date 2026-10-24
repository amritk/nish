// The listener's ECN flights under `--number-mode f64` (see `args`): every
// count and codepoint must stay an integer, so every check of
// `tests/link/net_quic_ecn` is run again, unchanged.
import { quicEcnChecks } from "../net_quic_ecn/checks";

export const main = (): i32 => quicEcnChecks();
