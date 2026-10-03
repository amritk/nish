// The parts of `nish/net/quic` under `--number-mode f64` (see `args`): every
// check of `tests/link/net_quic_conn_parts`, unchanged.
import { quicConnPartsChecks } from "../net_quic_conn_parts/checks";

export const main = (): i32 => quicConnPartsChecks();
