// NL3036: a `noPanic` that is not an array is refused, rather than read as an
// empty scope beside the policy.
import { dial } from "./client";

export const main = (): number => (dial(8080) ? 0 : 1);
