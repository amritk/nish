// A `using` declaration is a statement of a block: its scope joins when that
// block ends, and the body of this `if` is one statement, not a block.
import { scope } from "nish/threads";

export const main = (): i32 => {
  const go = true;
  if (go) using s = scope();
  return 0;
};
