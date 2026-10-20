// `nish/net/router` in the default number mode. The checks are in `checks.ts`,
// so that `tests/link/net_router_f64` runs the same ones under
// `--number-mode f64`.
import { routerChecks } from "./checks";

export const main = (): i32 => routerChecks();
