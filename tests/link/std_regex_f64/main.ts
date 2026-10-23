// The `std_regex` suite again, compiled with `--number-mode f64`: the module
// spells every width it uses, so a program in either mode gets the same answers.
import { runSuite } from "../std_regex/suite";

export const main = (): i32 => runSuite();
