// The `crypto_p256` suite again, compiled with `--number-mode f64`: the module
// spells every width it uses, so a program in either mode gets the same answers.
import { runSuite } from "../crypto_p256/suite";

export const main = (): i32 => runSuite();
