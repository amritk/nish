// `nish/net/quic`'s paths, in the default number mode: a client whose NAT
// rebinds its port or address mid-connection, path validation, and the
// forged sources RFC 9000 §9.3 guards against, each against the test client
// of `tests/link/net_quic_conn`. `tests/link/net_quic_path_f64` runs the same
// checks under `--number-mode f64`.
import { quicPathChecks } from "./checks";

export const main = (): i32 => quicPathChecks();
