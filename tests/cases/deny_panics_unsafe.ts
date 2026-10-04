// --deny-panics and `nish:unsafe` (docs/LANGUAGE.md, "The no-panic scope"):
// `uncheckedGet` and `uncheckedSet` have no check, so they cannot panic, and
// the import above is the visible opt-in to the undefined behaviour an index
// out of range would be. The scope allows them, as it allows out of memory:
// `--emit-panics` lists each as an `unchecked` site with `"allowed":true`, and
// `first`, which calls `get`, has no `call` site of its own. Without the import
// the call is refused (`reject_deny_panics_unsafe_no_import`).
import { uncheckedGet, uncheckedSet } from "nish:unsafe";

const get = (xs: i32[], i: i32): i32 => uncheckedGet(xs, i);

const mark = (bytes: u8[], i: i32): void => {
  uncheckedSet(bytes, i, toU8(7));
};

const first = (xs: i32[]): i32 => get(xs, 0);

export const main = (): number => {
  const words: i32[] = [10, 20, 30];
  console.log(get(words, 2));
  console.log(first(words));
  const bytes: u8[] = [1, 2, 3];
  mark(bytes, 1);
  console.log(uncheckedGet(bytes, 1));
  return 0;
};
