// The compiler a bench script builds with: `--compiler <path>` when the command
// line names one, `build/nish` (what `npm run build` leaves) otherwise.
//
//   node bench/run.mjs --compiler build/nish --validate
//
// Resolved by `tests/self/seed.js`, the suite's one reader of a compiler path:
// a native `nish` is run directly and a Node entry point (.js, .mjs, .cjs)
// under node, and one that is missing or does not answer `--version` is
// refused here rather than at the first benchmark.
import path from "node:path";

import { resolveSeed } from "../tests/self/seed.js";

/**
 * `{ cmd, prefix, rest }`: the command and the arguments that come before a
 * program's own, and `argv` with `--compiler <path>` taken out, so a script
 * reading its own options and positionals never sees the path. A path is
 * relative to the working directory, like any other path on a command line.
 */
export const compilerFrom = (argv) => {
  const at = argv.indexOf("--compiler");
  if (at >= 0 && argv[at + 1] === undefined) {
    console.error("--compiler needs a path");
    process.exit(2);
  }
  const spec = at >= 0 ? path.resolve(argv[at + 1]) : path.join("build", "nish");
  const compiler = resolveSeed(spec);
  if (compiler.error !== undefined) {
    const hint = at >= 0 ? "" : "; run `npm run build` first, or pass --compiler <nish>";
    console.error(`${compiler.error.replace(/^seed/, "compiler")}${hint}`);
    process.exit(2);
  }
  const rest = at >= 0 ? [...argv.slice(0, at), ...argv.slice(at + 2)] : argv;
  return { cmd: compiler.cmd, prefix: compiler.prefix, rest };
};
