// WP37 SBX-1, at run time: `pkg_runner` is granted `process.spawn` of a
// `#!` script, so the exec allowlist holds the script's interpreter (`sh`)
// as well. Under `--sandbox` (tests/run.js) the script runs and `sh` named
// directly is refused (docs/security/sandbox.md); with no argument it runs
// nothing and exits 0.
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
