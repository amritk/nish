// The policy is held by a `"nish"` the reader would not see, so it is refused
// where it is written (NL3032) rather than let the program that reaches `net`
// compile.
import { dial } from "./client";

export const main = (): number => (dial(8080) ? 0 : 1);
