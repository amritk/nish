// A QUIC server's wipes read back under `--number-mode f64` (see `args`): every
// check in `tests/link/net_quic_server_wipes`, run again unchanged.
import { serverWipeChecks } from "../net_quic_server_wipes/checks";

export const main = (): i32 => serverWipeChecks();
