// `nish/net/quic` under `--number-mode f64` (see `args`): every packet
// number, offset, credit and error code must stay an integer, so every check
// of `tests/link/net_quic_conn` is run again, unchanged.
import { quicConnChecks } from "../net_quic_conn/checks";

export const main = (): i32 => quicConnChecks();
