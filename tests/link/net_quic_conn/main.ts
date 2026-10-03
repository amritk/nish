// `nish/net/quic` sans-IO, in the default number mode: handshakes under the
// three suites, HelloRetryRequest, the stream data path, the connection-ID
// table and acknowledgements in a live connection, the anti-amplification
// limit, and every refusal, each against the test client in `client.ts`.
// `tests/link/net_quic_conn_f64` runs the same checks under
// `--number-mode f64`.
import { quicConnChecks } from "./checks";

export const main = (): i32 => quicConnChecks();
