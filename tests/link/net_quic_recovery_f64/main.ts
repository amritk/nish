// `nish/net/quic-recovery` under `--number-mode f64` (see `args`): every
// time, size, window and packet number must stay an integer, so every check
// of `tests/link/net_quic_recovery` is run again, unchanged.
import { quicRecoveryChecks } from "../net_quic_recovery/checks";

export const main = (): i32 => quicRecoveryChecks();
