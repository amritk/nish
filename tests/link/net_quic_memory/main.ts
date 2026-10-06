// The arena a QUIC connection leaves once its handshake lives in the slot,
// in the default number mode. The checks are in `checks.ts`, so that
// `tests/link/net_quic_memory_f64` runs the same ones under `--number-mode f64`.
import { memoryChecks } from "./checks";

export const main = (): i32 => memoryChecks();
