// NL3036: a second top-level `"nish"` is refused even when neither holds a
// policy, since the `noPanic` of one of them would be dropped in silence.
import { dial } from "./client";

export const main = (): number => (dial(8080) ? 0 : 1);
