// #198's first reproducer: one file reached through a linked directory. `args`
// names `alias/types.ts` as a second root, where `alias` is a link to `lib`,
// while this entry imports the same file as `./lib/types`. A module's identity
// is its real path, so the two spellings are one module: `Base` is declared
// once and does not clash with itself (NL3028), and `read` is defined once
// rather than being its own duplicate export. Keyed on the spelling, even
// normalised, the link hid that they were one file.
//
// #198 met it as a linked *working directory* — `nish main.ts $PWD/types.ts`
// run in one — which is this case with the link moved to the front of the
// path: the compiler resolves the working directory's real path, and the
// absolute spelling kept the link.
import { Base, read } from "./lib/types";

export const main = (): i32 => read(new Base()) + new Base().x - 7;
