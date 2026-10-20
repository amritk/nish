// `nish/net/router` under `--number-mode f64`: the checks of
// `tests/link/net_router`, where a bare `number` is a double.
import { routerChecks } from "../net_router/checks";

export const main = (): i32 => routerChecks();
