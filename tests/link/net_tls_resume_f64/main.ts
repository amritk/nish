// `tests/link/net_tls_resume` under `--number-mode f64` (see `args`): the same
// checks, unchanged.
import { resumeChecks } from "../net_tls_resume/checks";

export const main = (): i32 => resumeChecks();
