// `nish/net/quic-frame` under `--number-mode f64` (see `args`): every offset,
// length and varint here must stay an integer, so every check of
// `tests/link/net_quic_frame` is run again, unchanged.
import { quicFrameChecks } from "../net_quic_frame/checks";

export const main = (): i32 => quicFrameChecks();
