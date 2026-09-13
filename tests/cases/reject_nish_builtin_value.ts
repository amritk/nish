// The other direction: a function a builtin module exports is not a value, for
// the reason no function in this language is one.
import { readFileSync } from "nish:fs";

export const main = (): number => {
  const read = readFileSync;
  return read.length;
};
