// TLS session tickets sealed, opened and struck, in the default number mode.
// The checks are in `checks.ts`, so that `tests/link/net_tls_ticket_f64` runs
// the same ones under `--number-mode f64`; `tests/wipes/tls.js` compiles this
// program to count the wipes after `opt -O2`.
import { ticketChecks } from "./checks";

export const main = (): i32 => ticketChecks();
