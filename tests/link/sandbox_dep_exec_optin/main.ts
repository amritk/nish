// WP40 §2a, at run time: `pkg_runner` is granted `process.spawn=exec:env`
// and `process.spawn=true`, and runs the command line the program's arguments
// name through the spawn builtin the first argument names. Under `--sandbox`
// (tests/run.js) `env`, granted `exec:`, may execute what the allowlist holds,
// `true` among it; `true`, granted plainly, gets its one exec. With no
// argument it runs nothing and exits 0.
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
