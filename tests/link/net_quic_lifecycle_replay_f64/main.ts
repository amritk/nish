// `net_quic_lifecycle_replay` under `--number-mode f64` (see `args`): the same
// recorded scenarios, replayed through the same server code, where every
// time, length and packet number must stay an integer.
import { lcReplay } from "../net_quic_lifecycle_replay/replay";

export const main = (): i32 => lcReplay();
