// WP37 SBX-1, at run time: `pkg_runner` is granted `process.spawn` of a
// `#!` script and of `sh`, its interpreter. A program the grant names is
// spawnable even when it is also another entry's interpreter, so under
// `--sandbox` (tests/run.js) both run; with no argument it runs nothing and
// exits 0.
import { runProgram } from "pkg_runner";

export const main = (): i32 => {
  const args = process.argv;
  if (args.length < 2) {
    return 0;
  }
  const argv: string[] = [];
  for (let i = 1; i < args.length; i++) {
    argv.push(args[i]);
  }
  console.log(runProgram(argv));
  return 0;
};
