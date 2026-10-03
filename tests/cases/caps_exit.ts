// WP35: `process.exit` is `exit`, here spelled `exit` through `nish:process`,
// and the witness names the builtin the import renames. `exit` alone keeps a
// program deterministic: the status it chooses is computed from its input.
import { exit } from "nish:process";

const finish = (code: i32): void => {
  exit(code);
};

export const main = (): number => {
  console.log("finishing");
  finish(0);
  return 1;
};
