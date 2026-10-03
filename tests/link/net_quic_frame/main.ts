// `nish/net/quic-frame` — every frame of RFC 9000 §19 read and written, RFC
// 9001 Appendix A's frames, and every refusal — in the default number mode;
// `tests/link/net_quic_frame_f64` runs the same checks under `--number-mode f64`.
import { quicFrameChecks } from "./checks";

export const main = (): i32 => quicFrameChecks();
