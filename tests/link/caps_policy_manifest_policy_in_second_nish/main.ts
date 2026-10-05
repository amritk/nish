// NL3036: the policy is held by a second top-level `"nish"`, which is refused
// at its key rather than let the program that reaches `net` compile.
import { dial } from "./client";

export const main = (): number => (dial(8080) ? 0 : 1);
