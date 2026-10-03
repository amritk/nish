// The parts of `nish/net/quic` — transport parameters, received packet
// numbers and the connection-ID table — in the default number mode;
// `tests/link/net_quic_conn_parts_f64` runs the same checks under
// `--number-mode f64`.
import { quicConnPartsChecks } from "./checks";

export const main = (): i32 => quicConnPartsChecks();
