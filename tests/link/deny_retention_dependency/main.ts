// --deny-retention holds the root package only, as --deny-panics does: the
// dependency below drops a string on every pass of its loop (NL9016), which
// stays a performance warning, because the program's author cannot change that
// code. The program's own loop keeps numbers across passes, so it compiles.
import { lastLabel } from "retain_pkg";

export const main = (): i32 => {
  let total = 0;
  for (let i = 0; i < 4; i++) {
    total = total + lastLabel(i).length;
  }
  return total;
};
