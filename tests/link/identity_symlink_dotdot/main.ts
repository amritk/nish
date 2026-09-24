// #198's second reproducer: a link followed by `..`. `far` is a link to
// `other/inner`, so `far/../types.ts` — the second root `args` names — opens
// `other/types.ts`, a different file from the `./types` this entry imports.
// A module's identity is the file the operating system opens under a
// spelling, so the two are two modules and both are compiled: `expected.ir`
// names the root's `@eleven`. Normalised lexically first, `far/..` vanished,
// the root was taken for `./types.ts` and silently skipped.
//
// The two modules share the basename `types`, and from one directory
// (`nish main.ts far/../types.ts -o out/`) their entry-relative paths meet as
// well, which once wrote both to one `out/types.ll`; `tests/nish/cli.ts` runs
// that spelling and holds the two files it writes.
import { seven } from "./types";

export const main = (): i32 => seven();
