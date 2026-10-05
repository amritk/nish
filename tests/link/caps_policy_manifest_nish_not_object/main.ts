// NL3036: a `"nish"` that is not an object holds nothing the reader can
// honour, so it is refused rather than read as no policy.
import { dial } from "./client";

export const main = (): number => (dial(8080) ? 0 : 1);
