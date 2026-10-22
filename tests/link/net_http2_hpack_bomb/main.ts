// `nish/net/http2` against HPACK's worst case, in the default number mode; the
// checks are in `checks.ts`, so that `tests/link/net_http2_hpack_bomb_f64`
// runs the same ones under `--number-mode f64`.
import { hpackBombChecks } from "./checks";

export const main = (): i32 => hpackBombChecks();
