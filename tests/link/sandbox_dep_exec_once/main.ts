// WP37 SBX-1, at run time: `pkg_runner` is granted `process.spawn` of `find`,
// `env` and `true`, and runs the command line the program's arguments name
// through the spawn builtin the first argument names. Under `--sandbox`
// (tests/run.js) the granted program starts and nothing it executes does: not
// the ELF loader handed an ungranted binary, not another granted program, not
// itself (docs/security/sandbox.md). With no argument it runs nothing and
// exits 0.
import { runProgram } from "pkg_runner";

export const main = (): i32 => {
  const args = process.argv;
  if (args.length < 3) {
    return 0;
  }
  const argv: string[] = [];
  for (let i = 2; i < args.length; i++) {
    argv.push(args[i]);
  }
  console.log(runProgram(args[1], argv));
  return 0;
};
