// `nish/` names a module the standard library has; one it does not have is
// reported as that rather than as a missing file, because where the compiler
// is installed is not a fact about the program.
import { parse } from "nish/json";

export const main = (): number => 0;
