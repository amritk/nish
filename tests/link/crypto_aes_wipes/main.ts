// `aesKeyWipe` read back, and the AEADs' answers with their per-call state
// wiped, in the default number mode. The checks are in `checks.ts`, so that
// `tests/link/crypto_aes_wipes_f64` runs the same ones under `--number-mode f64`;
// `tests/wipes/crypto.js` compiles this program to count the wipes after `opt -O2`.
import { aesWipeChecks } from "./checks";

export const main = (): i32 => aesWipeChecks();
