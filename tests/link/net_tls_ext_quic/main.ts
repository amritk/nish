// `quic_transport_parameters` in `nish/net/tls`, in the default number mode;
// `tests/link/net_tls_ext_f64` runs the same checks under `--number-mode f64`.
import { quicChecks } from "./checks";

export const main = (): i32 => quicChecks();
