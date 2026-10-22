// `nish/net/http2` against HPACK's worst case under `--number-mode f64` (see
// `args`): every check of `tests/link/net_http2_hpack_bomb` again, in the mode
// where a bare literal is an `f64`.
import { hpackBombChecks } from "../net_http2_hpack_bomb/checks";

export const main = (): i32 => hpackBombChecks();
