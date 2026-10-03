// `nish/net/websocket` under `--number-mode f64` (see `args`): every check in
// `tests/link/net_websocket` again, unchanged, because a `std/` module has to
// mean the same thing in both modes (docs/wp26-stdlib.md §4).
import { websocketChecks } from "../net_websocket/checks";

export const main = (): i32 => websocketChecks();
