// Every refusal in `nish/net/tls` as its alert, in the default number mode;
// `tests/link/net_tls_ext_f64` runs the same checks under `--number-mode f64`.
import { refusalChecks } from "./checks";

export const main = (): i32 => refusalChecks();
