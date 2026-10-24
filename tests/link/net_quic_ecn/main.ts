// The listener's flights cut where a connection's ECN marking changes, in the
// default number mode. `tests/link/net_quic_ecn_f64` runs the same checks
// under `--number-mode f64`.
import { quicEcnChecks } from "./checks";

export const main = (): i32 => quicEcnChecks();
