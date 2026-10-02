// The SHA-2 length counters at 2^29, 2^31, 2^32, 2^61 and 2^64 bytes, under
// `--number-mode i32`; `checks.ts` says how, and `../crypto_sha2_lengths_f64`
// runs the same checks under `f64`.
import { lengthChecks } from "./checks";

export const main = (): i32 => lengthChecks();
