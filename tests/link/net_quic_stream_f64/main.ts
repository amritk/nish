// `nish/net/quic-stream` under `--number-mode f64` (see `args`): every
// offset, credit, limit and stream ID must stay an integer, so every check
// of `tests/link/net_quic_stream` is run again, unchanged.
import { quicStreamChecks } from "../net_quic_stream/checks";

export const main = (): i32 => quicStreamChecks();
