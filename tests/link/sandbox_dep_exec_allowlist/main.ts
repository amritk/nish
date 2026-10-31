// WP40 §2a, at run time: `pkg_runner` is granted `process.spawn` of `true`,
// and runs the program the first argument names. Under `--sandbox`
// (tests/run.js) `true` runs and any other program is refused by Landlock;
// with no argument it runs nothing and exits 0.
import { runProgram } from "pkg_runner";

export const main = (): i32 => {
  const args = process.argv;
  if (args.length < 2) {
    return 0;
  }
  console.log(runProgram(args[1]));
  return 0;
};
