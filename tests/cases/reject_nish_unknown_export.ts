// A builtin module exports what the compiler has a builtin for; `statSync` is
// not one, and the message lists what `nish:fs` does export.
import { statSync } from "nish:fs";

export const main = (): number => 0;
