// A QUIC server's wipes when it ends read back, in the default number mode.
// The checks are in `checks.ts`, so that `tests/link/net_quic_server_wipes_f64`
// runs the same ones under `--number-mode f64`; `tests/wipes/quic-server.js`
// compiles this program to count the wipes after `opt -O2`.
import { serverWipeChecks } from "./checks";

export const main = (): i32 => serverWipeChecks();
