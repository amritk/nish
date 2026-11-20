// The relay of `examples/relay/` under `--number-mode f64` (see `args`):
// every length, sequence number, counter, clock and close code must stay an
// integer, so every check of `tests/link/net_relay` is run again, unchanged.
import { relayChecks } from "../net_relay/checks";

export const main = (): i32 => relayChecks("build/net_relay_f64");

// #1689: in CI this program and tests/link/net_relay have failed the
// PEM-pair checks of ../net_relay/setup.ts, usually together in one job, a
// different subset each time for the same inputs: loads that must succeed
// fail and loads that must fail with a named error do not. It has not
// reproduced here: 200 serial runs under six busy loops, one run under each
// CPU-path pin (NISH_SIMD, NISH_SHA256, NISH_AES, ...), and one run under
// valgrind (no errors) all print expected.out.
