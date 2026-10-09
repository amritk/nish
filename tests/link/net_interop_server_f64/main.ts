// The interop server under `--number-mode f64` (see `args`): every check of
// `tests/link/net_interop_server` again, unchanged.
import { interopChecks } from "../net_interop_server/checks";

export const main = (): i32 => interopChecks();
