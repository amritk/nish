// `nish/net/quic-packet` under `--number-mode f64` (see `args`). A `std/`
// module has to compute the same thing in both modes (docs/wp26-stdlib.md
// §4), and every offset, length and packet number here is an `i32` or an
// `i64` that must not become an `f64`, so every check in
// `tests/link/net_quic_packet` is run again here, unchanged.
import { quicPacketChecks } from "../net_quic_packet/suite";

export const main = (): i32 => quicPacketChecks();
