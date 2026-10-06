// The arena a TLS 1.3 handshake leaves once its state lives in the slot, in
// the default number mode. The checks are in `checks.ts`, so that
// `tests/link/net_tls_memory_f64` runs the same ones under `--number-mode f64`.
import { memoryChecks } from "./checks";

export const main = (): i32 => memoryChecks();
