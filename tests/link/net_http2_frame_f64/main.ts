// `nish/net/http2-frame` under `--number-mode f64` (see `args`): every check of
// `tests/link/net_http2_frame` again, in the mode where a bare literal is an
// `f64`, since a `std/` module computes the same thing in both
// (docs/wp26-stdlib.md §4).
import { frameChecks } from "../net_http2_frame/checks";

export const main = (): i32 => frameChecks();
