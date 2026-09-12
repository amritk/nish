// `as` on a builtin import. The emitter dispatches builtins on the identifier's
// own text, so a rename is the case that proves the checker records which
// builtin a local name stands for rather than leaving the emitter to guess.
// `exit` is the other half: a dotted builtin (`process.exit`) imported under a
// plain name, still terminating control flow, so `main` may end on it.
import { readFileSync as slurp, writeFileSync as spill } from "nish:fs";
import { argv as args, exit } from "nish:process";
import { write as out } from "nish:io";

export const main = (): number => {
  spill("build/test/io_nish_rename.txt", `args: ${args.length > 0}\n`);
  out(slurp("build/test/io_nish_rename.txt"));
  exit(0);
};
