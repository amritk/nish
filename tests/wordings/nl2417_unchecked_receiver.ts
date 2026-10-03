// NL2417: an unchecked access reads or writes an array of numbers.
import { uncheckedGet } from "nish:unsafe";

export const main = (): i32 => {
  const names: string[] = ["a"];
  const name = uncheckedGet(names, 0);
  return name.length;
};
