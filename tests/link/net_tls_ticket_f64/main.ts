// `tests/link/net_tls_ticket` under `--number-mode f64` (see `args`): the same
// checks, unchanged.
import { ticketChecks } from "../net_tls_ticket/checks";

export const main = (): i32 => ticketChecks();
