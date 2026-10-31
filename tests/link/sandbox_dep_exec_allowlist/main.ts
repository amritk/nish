// WP40 §2a, at run time: `pkg_runner` is granted `process.spawn` of `true`,
// and runs the command line the program's arguments name. Under `--sandbox`
// (tests/run.js) `true` runs and any other program is refused by Landlock,
// except through the granted program's ELF loader (SBX-* in
// docs/security/sandbox.md, recorded open); with no argument it runs nothing
// and exits 0.
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
