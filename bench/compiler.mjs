// The compiler a bench script builds with: `--compiler <path>` when the command
// line names one, stage0 (`dist/index.js`) otherwise.
//
//   node bench/run.mjs --compiler build/nish --validate
//
// A native `nish` is run directly and a Node entry point (.js, .mjs, .cjs)
// under `node` -- the rule `NISH_BOOTSTRAP` follows in scripts/bootstrap.sh and
// tests/self/seed.js, so one path names a compiler the same way everywhere.
import path from "node:path";

const NODE_ENTRY = /\.(?:js|mjs|cjs)$/;

/**
 * `{ file, cmd, prefix, rest }`: the compiler's absolute path, the command and
 * the arguments that come before a program's own, and `argv` with
 * `--compiler <path>` taken out, so a script reading positionals does not read
 * the path as one. A path is relative to the working directory, like any other
 * path on a command line; the default is relative to the repository.
 */
export const compilerFrom = (argv, root) => {
  const at = argv.indexOf("--compiler");
  if (at >= 0 && argv[at + 1] === undefined) {
    console.error("--compiler needs a path");
    process.exit(2);
  }
  const file = at >= 0 ? path.resolve(argv[at + 1]) : path.join(root, "dist", "index.js");
  const rest = at >= 0 ? [...argv.slice(0, at), ...argv.slice(at + 2)] : argv;
  return NODE_ENTRY.test(file)
    ? { file, cmd: "node", prefix: [file], rest }
    : { file, cmd: file, prefix: [], rest };
};
