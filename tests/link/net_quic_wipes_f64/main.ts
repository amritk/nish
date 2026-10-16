// A QUIC connection's wipes read back under `--number-mode f64` (see `args`):
// every check in `tests/link/net_quic_wipes`, run again unchanged.
import { quicWipeChecks } from "../net_quic_wipes/checks";

export const main = (): i32 => quicWipeChecks();
