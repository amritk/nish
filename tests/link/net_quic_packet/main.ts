// `nish/net/quic-packet` against RFC 9000 Appendix A and RFC 9001 Appendix A,
// and every refusal, in the default number mode. The checks are in
// `checks.ts` and `refusals.ts`, so that `tests/link/net_quic_packet_f64`
// runs the same ones under `--number-mode f64`.
import { quicPacketChecks } from "./suite";

export const main = (): i32 => quicPacketChecks();
