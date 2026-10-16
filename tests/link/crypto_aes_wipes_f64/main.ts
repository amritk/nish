// `aesKeyWipe` read back under `--number-mode f64` (see `args`): every check in
// `tests/link/crypto_aes_wipes`, run again unchanged.
import { aesWipeChecks } from "../crypto_aes_wipes/checks";

export const main = (): i32 => aesWipeChecks();
