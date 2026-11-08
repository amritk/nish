// The compiler a bench script builds with: `--compiler <path>` when the command
// line names one, `build/nish` (what `npm run build` leaves) otherwise. And the
// hardening a bench's C twin is built with and checked for, so it matches a
// Nish binary's.
//
//   node bench/run.mjs --compiler build/nish --validate
//
// Resolved by `tests/self/seed.js`, the suite's one reader of a compiler path:
// a native `nish` is run directly and a Node entry point (.js, .mjs, .cjs)
// under node, and one that is missing or does not answer `--version` is
// refused here rather than at the first benchmark.
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

import { hardeningProblems } from "../scripts/check-hardening.mjs"
import { resolveSeed } from "../tests/self/seed.js"

/**
 * `{ cmd, prefix, rest }`: the command and the arguments that come before a
 * program's own, and `argv` with `--compiler <path>` taken out, so a script
 * reading its own options and positionals never sees the path. A path is
 * relative to the working directory, like any other path on a command line.
 */
export const compilerFrom = (argv) => {
  const at = argv.indexOf("--compiler")
  if (at >= 0 && argv[at + 1] === undefined) {
    console.error("--compiler needs a path")
    process.exit(2)
  }
  const spec = at >= 0 ? path.resolve(argv[at + 1]) : path.join("build", "nish")
  const compiler = resolveSeed(spec)
  if (compiler.error !== undefined) {
    const hint = at >= 0 ? "" : "; run `npm run build` first, or pass --compiler <nish>"
    console.error(`${compiler.error.replace(/^seed/, "compiler")}${hint}`)
    process.exit(2)
  }
  const rest = at >= 0 ? [...argv.slice(0, at), ...argv.slice(at + 2)] : argv
  return { cmd: compiler.cmd, prefix: compiler.prefix, rest }
}

/**
 * scripts/build.sh's hardening for a C unit compiled by `cc`, read from the
 * script rather than copied, so a bench's C twin cannot drift from what a Nish
 * binary is built with: the block runs with this compiler, so the target's
 * control-flow flag (-fcf-protection=full or -mbranch-protection=standard),
 * the stack protector, _FORTIFY_SOURCE and the ELF-only stack-clash, relro,
 * now and noexecstack flags come out as the build picks them for the speed
 * profile. Its PIE is clang's default, as it is the build's. Exits 2 when the
 * block cannot be found or run.
 */
export const hardeningFlags = (cc) => {
  const script = fs.readFileSync(path.join(import.meta.dirname, "..", "scripts", "build.sh"), "utf8")
  const block = /^# Hardening, on every native profile[\s\S]*?^tls=\(\)$/m.exec(script)?.[0]
  if (block === undefined) {
    console.error("scripts/build.sh has no hardening block ending at `tls=()` to read")
    process.exit(2)
  }
  const r = spawnSync(
    "bash",
    ["-c", 'CC=$1; profile=speed; common=(); eval "$2"; printf "%s\\n" "${common[@]}"', "_", cc, block],
    { encoding: "utf8" }
  )
  if (r.status !== 0) {
    console.error(`reading scripts/build.sh's hardening failed\n${r.stderr}`)
    process.exit(2)
  }
  return r.stdout.split("\n").filter((f) => f !== "")
}

/**
 * What scripts/check-hardening.mjs finds `binary` lacks of the hardening a
 * Nish binary carries, one line each, or null when it lacks nothing. A machine
 * with no tool to read the binary is a finding too, so a bench never passes an
 * unchecked twin as checked.
 */
export const unhardened = (binary) => {
  const { skip, problems } = hardeningProblems(binary)
  if (skip !== null) {
    return `cannot check ${binary}: ${skip}`
  }
  return problems.length === 0 ? null : problems.map((p) => `${binary}: ${p}`).join("\n")
}
