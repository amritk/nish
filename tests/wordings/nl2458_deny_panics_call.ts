// --deny-panics refuses a call into the standard library that may panic
// (NL2458): the callee is outside the scope, so the call is where it is refused.
import { toFixed } from "nish/text";

export const show = (x: f64, digits: i32): string => toFixed(x, digits);
