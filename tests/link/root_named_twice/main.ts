// One file named twice: `args` names `types.ts` again as a root, spelled from
// the working directory while this entry is named by absolute path and imports
// it as `./types`. It is one module, so its `Base` is declared once and does
// not clash with itself (NL3028), and `read` is defined once rather than being
// its own duplicate export; keyed on the spelling, it was two modules.
// `tests/run.js` runs the `./types.ts` and absolute spellings too.
import { Base, read } from "./types";

export const main = (): i32 => read(new Base()) + new Base().x - 7;
