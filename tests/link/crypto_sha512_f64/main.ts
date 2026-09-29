// The `crypto_sha512` suite again, compiled with `--number-mode f64`: the module
// spells every width it uses, so a program in either mode gets the same digests.
import { runSuite } from "../crypto_sha512/suite";

export const main = (): i32 => runSuite();
