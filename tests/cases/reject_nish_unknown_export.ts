// A builtin module exports what the compiler has a builtin for; `readdirSync`
// is not one, and the message lists what `nish:fs` does export.
import { readdirSync } from "nish:fs";

export const main = (): number => 0;
