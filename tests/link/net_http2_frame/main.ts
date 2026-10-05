// `nish/net/http2-frame` in the default number mode: every frame type read
// from bytes built by hand and written back to them, and every refusal. The
// checks are in `checks.ts`, so that `tests/link/net_http2_frame_f64` runs the
// same ones under `--number-mode f64`.
import { frameChecks } from "./checks";

export const main = (): i32 => frameChecks();
