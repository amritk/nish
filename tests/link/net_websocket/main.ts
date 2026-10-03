// `nish/net/websocket` in the default number mode. The checks are in
// `checks.ts`, so that `tests/link/net_websocket_f64` runs the same ones under
// `--number-mode f64`.
import { websocketChecks } from "./checks";

export const main = (): i32 => websocketChecks();
