// RFC 9221's DATAGRAM frames in `nish/net/quic`, and the listener's GSO
// flight read back through GRO over loopback, in the default number mode.
// `tests/link/net_quic_datagram_f64` runs the same checks under
// `--number-mode f64`.
import { quicDatagramChecks } from "./checks";

export const main = (): i32 => quicDatagramChecks();
