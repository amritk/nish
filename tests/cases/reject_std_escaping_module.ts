// A `nish/` specifier names a module *inside* the standard library, so it may
// not climb out of it. This one used to resolve — the join is only a join, and
// a file that happens to sit there is opened — and to be named `../escape/lib.ts`,
// which is spelled from wherever the compiler is installed rather than from
// anything about the program (WP19 §A7).
import { thing } from "nish/../../escape/lib";

export const main = (): number => thing();
