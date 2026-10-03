// `nish/net/tls` against RFC 8448 §3 under `--number-mode f64` (see `args`).
// A `std/` module has to compute the same thing in both modes
// (docs/wp26-stdlib.md §4), and every length and offset in the handshake is
// `i32` arithmetic that must not become an `f64`, so every check in
// `tests/link/net_tls_rfc8448` is run again here, unchanged.
import { rfc8448Checks } from "../net_tls_rfc8448/checks";

export const main = (): i32 => rfc8448Checks();
