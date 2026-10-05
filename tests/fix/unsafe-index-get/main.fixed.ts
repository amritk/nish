// A read the checker cannot prove in range. The module imports nothing, so
// the fix adds the import before its first statement, and with a semicolon,
// because the module ends its statements with one.
import { uncheckedGet } from "nish:unsafe";

export const at = (xs: i32[], k: i32): i32 => uncheckedGet(xs, k);
