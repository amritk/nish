// The relay of `examples/relay/` under `--number-mode f64` (see `args`):
// every length, sequence number, counter, clock and close code must stay an
// integer, so every check of `tests/link/net_relay` is run again, unchanged.
import { relayChecks } from "../net_relay/checks";

export const main = (): i32 => relayChecks();
