// `nish/net/webtransport` under `--number-mode f64` (see `args`): every
// stream ID, session ID, quarter stream ID, code and count must stay an
// integer, so every check of `tests/link/net_webtransport` is run again,
// unchanged.
import { wtChecks } from "../net_webtransport/checks";

export const main = (): i32 => wtChecks();
