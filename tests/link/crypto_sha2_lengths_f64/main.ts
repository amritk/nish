// `../crypto_sha2_lengths` under `--number-mode f64` (see `args`): the byte
// counters are `i64` and `u64` whatever `number` is, and a counter that became
// an `f64` would lose its low bits past 2^53 and show here.
import { lengthChecks } from "../crypto_sha2_lengths/checks";

export const main = (): i32 => lengthChecks();
