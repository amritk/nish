// `nish/net/quic-stream` inside `nish/net/quic`, sans-IO, in the default
// number mode: streams both ways and of both kinds, flow control at both
// levels, the limits, RESET_STREAM and STOP_SENDING, every refusal, and
// nothing allocated per packet or kept by a slot reused connection after
// connection. `tests/link/net_quic_stream_f64` runs the same checks under
// `--number-mode f64`.
import { quicStreamChecks } from "./checks";

export const main = (): i32 => quicStreamChecks();
