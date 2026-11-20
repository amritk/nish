/**
 * `--allow-panics` for the test scripts: what a build of a program that may
 * panic on purpose passes, and only to a compiler that lists the flag.
 *
 *   import { withAllowPanics } from "./allow-panics.js"
 *   spawnSync(NISH, withAllowPanics(NISH, ["case.ts", "-o", out]))
 *
 * The compiler holds every module of the root package to no panic by
 * default, and the flag (`ALLOW_PANICS_FLAG` in `src/options.ts`) relaxes that
 * to the `noPanic` list, so the suite's cases, fixtures and fuzz targets, which
 * panic on purpose, keep building. An example or a docs program a user would
 * copy is the exception: the helper leaves it strict, so it proves the default,
 * unless its own source opts out with the `OPT_OUT` header, which also names
 * the reason and the follow-up.
 *
 * It is a probe, not "the seed never gets it": the last release exits 2 on a
 * flag it does not know, and `NISH_BOOTSTRAP` or `--seed` can name any release
 * or a stub. Each compiler's `--help` is read once per process and cached by
 * path. `scripts/nish-compiler.sh` (`nish_allow_panics`) asks the same
 * question for the shell scripts.
 */
import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

/** The flag, as `ALLOW_PANICS_FLAG` in `src/options.ts` spells it. */
const ALLOW_PANICS = "--allow-panics"

/** `.js` / `.mjs` / `.cjs` runs under Node, as `tests/self/seed.js` reads a seed. */
const NODE_ENTRY = /\.(?:js|mjs|cjs)$/

/** The commands whose arguments are not a compile's: no flag goes to them. */
const NOT_A_COMPILE = new Set(["upgrade", "c-import", "break"])

/** The repository root, which `EXAMPLE` is anchored to. */
const ROOT = path.resolve(import.meta.dirname, "..")

/**
 * A program under the repository's own `examples/` or `docs/`, relative to
 * `ROOT`: a user copies it, so its build stays strict and proves the default
 * rather than the harness. A directory merely named `examples` elsewhere (a
 * fixture, a scratch copy under `build/`) is not one. A relative path is read
 * from the process's working directory, as the suite runs from the root.
 */
const EXAMPLE = /^(?:examples|docs)[\\/]/

/**
 * The header line an example that keeps a panic site on purpose opens with;
 * `scripts/smoke.sh` reads its `// smoke: args --allow-panics` instead.
 */
const OPT_OUT = "// Opt-out (`--allow-panics`):"

/**
 * Whether `file` is one of the repository's examples or docs programs that is
 * held to the default: it does not carry `OPT_OUT`. A file that cannot be read
 * is held to it, and the compile reports why.
 */
const isStrictExample = (file) => {
  if (!EXAMPLE.test(path.relative(ROOT, path.resolve(file)))) {
    return false
  }
  try {
    return !fs.readFileSync(file, "utf8").includes(OPT_OUT)
  } catch {
    return true
  }
}

/** Flags that already decide the panic scope, or ask for no compile at all. */
const DECIDES = new Set(["--deny-panics", ALLOW_PANICS, "-h", "--help", "-v", "--version"])

/** compiler path -> whether its `--help` lists the flag. */
const listed = new Map()

/**
 * Whether `compiler --help` lists `--allow-panics`. A compiler that cannot be
 * run, or exits nonzero, does not: the call then goes through unchanged and
 * fails, or not, on its own terms.
 */
const listsAllowPanics = (compiler) => {
  const key = path.resolve(compiler)
  let answer = listed.get(key)
  if (answer === undefined) {
    const [cmd, prefix] = NODE_ENTRY.test(key) ? [process.execPath, [key]] : [key, []]
    const help = spawnSync(cmd, [...prefix, "--help"], {
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
      timeout: 60_000,
    })
    answer = help.status === 0 && typeof help.stdout === "string" && help.stdout.includes(ALLOW_PANICS)
    listed.set(key, answer)
  }
  return answer
}

/**
 * `args` with `--allow-panics` added when `compiler` lists it and the call is
 * a compile or a `run` whose own flags leave the scope open: it names a `.ts`
 * file that is not a strict example (`isStrictExample`), is not `upgrade`,
 * `c-import` or `break`, and passes none of
 * `--deny-panics`, `--allow-panics`, `--help` or `--version` before the
 * program. The flag goes first, or right after `run`, where the compiler's
 * flags are; a `run`'s program arguments are never read. Otherwise `args`
 * itself is returned.
 */
const withAllowPanics = (compiler, args) => {
  if (args.length === 0 || NOT_A_COMPILE.has(args[0])) {
    return args
  }
  const run = args[0] === "run" ? 1 : 0
  const program = args.findIndex((arg, i) => i >= run && arg.endsWith(".ts"))
  if (program < 0 || isStrictExample(args[program])) {
    return args
  }
  const ownFlags = run === 1 ? args.slice(1, program) : args
  if (ownFlags.some((arg) => DECIDES.has(arg)) || !listsAllowPanics(compiler)) {
    return args
  }
  return [...args.slice(0, run), ALLOW_PANICS, ...args.slice(run)]
}

export { ALLOW_PANICS, listsAllowPanics, withAllowPanics }
