#!/usr/bin/env node
// PostToolUse hook: format and lint-fix each file an agent edits, as a
// pre-commit hook would, with no new dependency.
//
// `npm run lint` is `biome check .` with the formatter on, so an unformatted
// file fails CI. Running `biome check --write` on the one file an Edit or a
// Write just touched keeps an agent's change in the house style as it is
// made, rather than leaving a whole-tree `npm run format` to someone later.
// Only safe fixes are applied; anything Biome cannot fix is left for
// `npm run lint` to report.
//
// What it touches: the file named by the tool input's `file_path`, when that
// file is inside the repository and has an extension Biome reads. Biome's own
// `files.includes` in `biome.json` still decides the rest, so a test fixture
// under `tests/cases/` is left alone exactly as `npm run format` leaves it.
//
// It never blocks: a PostToolUse hook runs after the edit has happened, and
// one that cannot parse its input, or a Biome that is not installed, exits 0.
//
// The cases are in `format-edited.test.mjs` beside this file; `npm test` runs
// it:
//
//   node .claude/hooks/format-edited.test.mjs
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

/** The extensions Biome formats in this repository. */
const BIOME_READS = /\.(?:ts|js|mjs|cjs|json|jsonc)$/

/**
 * The file to format for one hook payload, or `null` when there is none: no
 * `file_path`, an extension Biome does not read, or a path outside `root`.
 */
export const fileToFormat = (payload, root) => {
  const file = payload?.tool_input?.file_path
  if (typeof file !== "string" || !BIOME_READS.test(file)) {
    return null
  }
  const absolute = path.resolve(root, file)
  const relative = path.relative(root, absolute)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null
  }
  return relative
}

const main = () => {
  let payload
  try {
    payload = JSON.parse(fs.readFileSync(0, "utf8"))
  } catch {
    return 0
  }
  const root = process.env.CLAUDE_PROJECT_DIR ?? payload?.cwd ?? process.cwd()
  const file = fileToFormat(payload, root)
  if (file === null) {
    return 0
  }
  const biome = path.join(root, "node_modules", ".bin", "biome")
  if (!fs.existsSync(biome)) {
    return 0
  }
  // `--files-ignore-unknown` and `--no-errors-on-unmatched` make a file that
  // `biome.json` does not include a quiet no-op rather than an error.
  spawnSync(biome, ["check", "--write", "--files-ignore-unknown=true", "--no-errors-on-unmatched", file], {
    cwd: root,
    stdio: "ignore",
  })
  return 0
}

if (process.argv[1] === import.meta.filename) {
  process.exit(main())
}
