// The vendored SQLite runs, not only links: `memory.ts` initialises it, opens
// an in-memory database through its VFS and runs its SQL tokenizer.
// tests/run.js also builds this program for `--profile wasi` and runs it under
// Node's WASI, so a wasi build of the amalgamation that links but cannot open a
// database fails.
import { openMemory } from "./memory.ts";

export const main = (): i32 => {
  console.log(openMemory());
  return 0;
};
