#!/usr/bin/env node
// Bring `origin/main` into the current branch and regenerate the goldens the
// merge moved.
//
// The generated goldens -- `tests/self/goldens/` (stage1's `--emit-checked`
// dump and its siblings) and `tests/differential/goldens/` (the frozen
// rewrites and their register) -- are written by their generators, never by
// hand, and CLAUDE.md says so twice: a conflict in one is resolved by
// regenerating, and a merge that reports no conflict regenerates too, because
// two changes to different modules can still move the same golden without a
// textual conflict (#549 after #547). Done by hand that is five commands and a
// `git rm` per modify/delete conflict; this is all of them.
//
//   npm run sync-main                 fetch, merge, regenerate, stage
//   npm run sync-main -- --continue   after resolving the other conflicts by hand
//
// A conflicted path under `tests/self/goldens/` is taken out of the index and
// the working tree, so regeneration writes it fresh. The differential store is
// not treated that way: its rewrites are frozen, not regenerable (the rewriter
// typed them with stage0's checker), and `--update` would answer a deleted
// `rewrites.txt` by moving every program into the unfrozen register. A
// conflict there, or anywhere else -- source, docs, a tracked `.ll` -- is a
// real one: the script names it
// and stops with the merge still open, and `--continue` picks up from there
// once it is resolved and `git add`ed. The script never commits: it stages the
// regenerated goldens and prints their stat, and the diff is read before
// `git commit --no-edit` finishes the merge.
//
// The seed that builds stage1 is the one `tests/self/goldens.js` resolves:
// `NISH_BOOTSTRAP`, then `build/nish`.
//
// Exit 0 when the goldens are regenerated and staged, 1 when a conflict
// outside them needs resolving or a generator failed, 2 on a usage error or a
// working tree that is not clean.
import { spawnSync } from "node:child_process"
import { rmSync } from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
/** What a conflict is resolved in by regenerating. */
const REGENERABLE = "tests/self/goldens/"
/** What the generators write, and so what is staged after them. */
const GENERATED = [REGENERABLE, "tests/differential/goldens/"]
const GENERATORS = [
  ["tests/self/goldens.js", "--update"],
  ["tests/differential/goldens.js", "--update"],
]

const run = (cmd, args, options = {}) =>
  spawnSync(cmd, args, { cwd: root, encoding: "utf8", maxBuffer: 1 << 28, ...options })

/** Run git, and stop the script when it fails. */
const git = (...args) => {
  const r = run("git", args)
  if (r.status !== 0) {
    process.stderr.write(`sync-main: git ${args.join(" ")} failed:\n${r.stderr}`)
    process.exit(1)
  }
  return r.stdout
}

const lines = (text) => text.split("\n").filter((line) => line.length > 0)

const fail = (code, message) => {
  process.stderr.write(`sync-main: ${message}\n`)
  process.exit(code)
}

const argv = process.argv.slice(2)
const unknown = argv.filter((arg) => arg !== "--continue")
if (unknown.length > 0) {
  fail(2, `unknown argument ${unknown[0]}; usage: npm run sync-main [-- --continue]`)
}
const resume = argv.includes("--continue")
const merging = () => run("git", ["rev-parse", "-q", "--verify", "MERGE_HEAD"]).status === 0

if (resume) {
  if (!merging()) {
    fail(2, "--continue needs a merge in progress, and there is none")
  }
} else {
  if (merging()) {
    fail(2, "a merge is already in progress; resolve it and run with --continue")
  }
  if (lines(git("status", "--porcelain", "--untracked-files=no")).length > 0) {
    fail(2, "the working tree has uncommitted changes; commit or stash them first")
  }
  git("fetch", "origin", "main")
  // A conflict makes `git merge` exit 1, which is the case handled below, so
  // its status is not git()'s to judge.
  const merged = run("git", ["merge", "--no-commit", "origin/main"])
  process.stdout.write(merged.stdout)
  if (merged.status !== 0 && !merging()) {
    fail(1, `git merge origin/main failed:\n${merged.stderr}`)
  }
}

const regenerable = (file) => file.startsWith(REGENERABLE)
const unmerged = lines(git("diff", "--name-only", "--diff-filter=U"))
const regenerate = unmerged.filter(regenerable)
if (regenerate.length > 0) {
  git("rm", "--cached", "-q", "--", ...regenerate)
  for (const file of regenerate) {
    rmSync(path.join(root, file), { force: true })
  }
  process.stdout.write(`sync-main: ${regenerate.length} conflicted golden(s) left to regenerate\n`)
}
const real = unmerged.filter((file) => !regenerable(file))
if (real.length > 0) {
  fail(
    1,
    "these conflicts cannot be regenerated, so resolve them by hand:\n\n" +
      real.map((file) => `  ${file}\n`).join("") +
      "\nthen `git add` them and run `npm run sync-main -- --continue`"
  )
}

// The index as the merge left it, so the stat below shows what regeneration
// moved rather than everything `main` brought in.
const merged = git("write-tree").trim()
for (const [script, ...args] of GENERATORS) {
  process.stdout.write(`sync-main: node ${script} ${args.join(" ")}\n`)
  const r = run(process.execPath, [script, ...args])
  if (r.status !== 0) {
    process.stdout.write(r.stdout)
    process.stderr.write(r.stderr)
    fail(1, `${script} exited ${r.status ?? r.signal}; the merge is left open`)
  }
  const tail = lines(r.stdout).at(-1)
  if (tail !== undefined) {
    process.stdout.write(`  ${tail}\n`)
  }
}

git("add", "-A", "--", ...GENERATED)
const stat = git("diff", "--cached", "--stat", merged, "--", ...GENERATED)
process.stdout.write(stat.length > 0 ? stat : "sync-main: regeneration moved no golden\n")
if (merging()) {
  process.stdout.write("\nRead the staged diff, then finish the merge: git commit --no-edit\n")
} else if (stat.length > 0) {
  process.stdout.write("\nRead the staged diff, then commit it.\n")
}
