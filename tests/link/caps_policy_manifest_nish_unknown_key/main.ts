// NL3036: a key of `"nish"` that is neither `noPanic` nor `capabilities` is
// refused, because a misspelt one would leave what it meant unread.
import { dial } from "./client";

export const main = (): number => (dial(8080) ? 0 : 1);
