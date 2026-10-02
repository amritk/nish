// `../crypto_hkdf_k1_bounds` under `--number-mode f64` (see `args`).
import { boundsChecks } from "../crypto_hkdf_k1_bounds/checks";

export const main = (): i32 => boundsChecks();
