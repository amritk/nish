// The relay of `examples/relay/` under `--number-mode f64` (see `args`):
// every length, sequence number, counter, clock and close code must stay an
// integer, so every check of `tests/link/net_relay` is run again, unchanged.
import { relayChecks } from "../net_relay/checks";

export const main = (): i32 => relayChecks("build/net_relay_f64");

// #1689: in CI this program and tests/link/net_relay have failed the
// identity checks of setup.ts together ("expected true, got false" on the
// PEM-pair and renewal checks). It has not reproduced here: the binary has run
// 200 times serially under six busy loops, and under every CPU-path pin
// (NISH_SIMD, NISH_SHA256, NISH_AES, ...), with no failure.
