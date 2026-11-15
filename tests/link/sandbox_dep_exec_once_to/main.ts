// WP37 SBX-1, at run time, through `spawnSyncTo`: `pkg_runner` is granted
// `process.spawn` of `find` and `fs.write` beneath `out/`, and runs the
// command line the program's arguments name with stdout sent to the file the
// first one names. Under `--sandbox` (tests/run.js) `find` starts, its output
// file is created, and nothing `find` executes runs
// (docs/security/sandbox.md). With no argument it runs nothing and exits 0.
import { runProgramTo } from "pkg_runner";

export const main = (): i32 => {
  const args = process.argv;
  if (args.length < 3) {
    return 0;
  }
  const argv: string[] = [];
  for (let i = 2; i < args.length; i++) {
    argv.push(args[i]);
  }
  console.log(runProgramTo(argv, args[1]));
  return 0;
};
