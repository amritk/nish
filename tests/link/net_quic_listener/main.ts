// `nish/net/quic-listener`'s window form, sans-IO: `handleWindow` answers
// what `handle` answers, from a window of a larger buffer and into one
// answer made once, and keeps nothing (H3-3). `tests/link/net_quic_listener_f64`
// runs the same checks under `--number-mode f64`.
import { listenerChecks } from "./checks";

export const main = (): i32 => listenerChecks();
