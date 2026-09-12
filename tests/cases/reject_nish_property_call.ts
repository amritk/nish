// `argv` is a value, not a function: the import carries which of the two a
// name is, so calling one is refused at the call rather than inside a builtin
// that was handed the wrong node.
import { argv } from "nish:process";

export const main = (): number => {
  argv();
  return 0;
};
