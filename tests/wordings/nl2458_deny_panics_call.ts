// --deny-panics refuses a call into the standard library that may panic
// (NL2458): the callee is outside the scope, so the call is where it is refused.
import { trim } from "nish/text";

export const tidy = (s: string): string => trim(s);
