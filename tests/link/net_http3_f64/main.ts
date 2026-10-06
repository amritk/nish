// `nish/net/http3` under `--number-mode f64` (see `args`): every stream ID,
// offset, length and count must stay an integer, so every check of
// `tests/link/net_http3` is run again, unchanged.
import { http3Checks } from "../net_http3/checks";

export const main = (): i32 => http3Checks();
