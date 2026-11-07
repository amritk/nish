// `nish/net/quic`'s paths under `--number-mode f64` (see `args`): every
// count, deadline and packet number of a migration must stay an integer, so
// every check of `tests/link/net_quic_path` is run again, unchanged.
import { quicPathChecks } from "../net_quic_path/checks";

export const main = (): i32 => quicPathChecks();
