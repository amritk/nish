// `nish/net/quic-recovery` sans-IO, in the default number mode: RFC 9002's
// RTT estimate, loss detection, probe timeout and NewReno worked by hand
// from Appendices A and B, then the same machinery inside `nish/net/quic`
// under scripted loss, reordering and a black hole, and the listener's
// pacer. `tests/link/net_quic_recovery_f64` runs the same checks under
// `--number-mode f64`.
import { quicRecoveryChecks } from "./checks";

export const main = (): i32 => quicRecoveryChecks();
