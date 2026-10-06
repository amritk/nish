// RFC 9221's DATAGRAM frames and GSO batching under `--number-mode f64`
// (see `args`): every size, offset and segment must stay an integer, so
// every check of `tests/link/net_quic_datagram` is run again, unchanged.
import { quicDatagramChecks } from "../net_quic_datagram/checks";

export const main = (): i32 => quicDatagramChecks();
