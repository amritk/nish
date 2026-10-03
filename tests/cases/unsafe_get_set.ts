// `uncheckedGet` and `uncheckedSet` from `nish:unsafe` (docs/LANGUAGE.md,
// "nish:unsafe"): the load and the store `xs[i]` and `xs[i] = v` lower to, with
// no `len` load, no compare and no branch to the bounds panic. One receiver of
// each width class: a word (`i32[]`), a byte (`u8[]`) and a double (`f64[]`).
// The exported functions take the index as a parameter, so no proof could have
// removed a check either way.
import { uncheckedGet, uncheckedSet } from "nish:unsafe";

export const getI32 = (xs: i32[], i: i32): i32 => uncheckedGet(xs, i);

export const setI32 = (xs: i32[], i: i32, v: i32): void => {
  uncheckedSet(xs, i, v);
};

export const getU8 = (bytes: readonly u8[], i: i32): u8 => uncheckedGet(bytes, i);

export const setU8 = (bytes: u8[], i: i32, v: u8): void => {
  uncheckedSet(bytes, i, v);
};

export const getF64 = (xs: f64[], i: i32): f64 => uncheckedGet(xs, i);

export const setF64 = (xs: f64[], i: i32, v: f64): void => {
  uncheckedSet(xs, i, v);
};

export const main = (): number => {
  const words: i32[] = [10, 20, 30];
  setI32(words, 2, getI32(words, 0) + getI32(words, 1));
  console.log(getI32(words, 2));
  const bytes: u8[] = [1, 2, 3, 4];
  setU8(bytes, 0, toU8(255));
  console.log(getU8(bytes, 0));
  console.log(getU8(bytes, 3));
  const halves: f64[] = [0.5, 1.5];
  setF64(halves, 1, getF64(halves, 0) * 5.0);
  console.log(getF64(halves, 1));
  return 0;
};
