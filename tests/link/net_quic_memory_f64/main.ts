// `tests/link/net_quic_memory` under `--number-mode f64` (see `args`): the
// same runs, unchanged.
import { memoryChecks } from "../net_quic_memory/checks";

export const main = (): i32 => memoryChecks();
