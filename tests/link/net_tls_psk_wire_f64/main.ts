// The `pre_shared_key` wire checks of `nish/net/tls` under `--number-mode f64`
// (see `args`): the u32 ticket ages, `tlsWriteNewSessionTicket`'s 32-bit
// fields and the PSK schedule run with every untyped number a double. The
// exit code is the suite's.
import { pskWireChecks } from "../net_tls_psk_wire/checks";

export const main = (): i32 => pskWireChecks();
