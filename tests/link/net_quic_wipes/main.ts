// A QUIC connection's wipes read back, in the default number mode. The checks
// are in `checks.ts`, so that `tests/link/net_quic_wipes_f64` runs the same
// ones under `--number-mode f64`; `tests/wipes/quic.js` compiles this program
// to count the wipes after `opt -O2`.
import { quicWipeChecks } from "./checks";

export const main = (): i32 => quicWipeChecks();
