// NL3036: a second top-level `"nish"` is refused at its key, whatever it
// holds, since one of the two would be dropped in silence.
import { dial } from "./client";

export const main = (): number => (dial(8080) ? 0 : 1);
