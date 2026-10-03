// `net_quic_conn_replay` under `--number-mode f64` (see `args`): the same
// recorded exchange, replayed through the same server code, where every
// offset, length and packet number must stay an integer.
import { replay } from "../net_quic_conn_replay/replay";

export const main = (): i32 => replay();
