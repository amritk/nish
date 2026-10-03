// `nish/net/quic-listener` and the lifecycle half of `nish/net/quic`, sans-IO,
// in the default number mode: Version Negotiation, Retry and its token, the
// stateless reset, the idle timeout and key update, each against the test
// client of `tests/link/net_quic_conn`. `tests/link/net_quic_lifecycle_f64`
// runs the same checks under `--number-mode f64`.
import { quicLifecycleChecks } from "./checks";

export const main = (): i32 => quicLifecycleChecks();
