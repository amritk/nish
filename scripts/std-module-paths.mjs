#!/usr/bin/env node
// The standard library's module files, one repository path per line:
// `std/text.ts`, `std/crypto/sha256.ts`, ...
//
//   node scripts/std-module-paths.mjs
//
// Read from `stdModuleNames` in `src/std-modules.ts` of the tree this script
// sits in, so a release's presence gates (`.github/workflows/release.yml`)
// check the modules of the commit being released and adding a module never
// edits a workflow. `tests/run.js` holds the literal to what `std/` has, and
// this script's answer and each gate's call to it to that literal.
import fs from "node:fs"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const source = fs.readFileSync(path.join(root, "src", "std-modules.ts"), "utf8")
// The formatter may break the arrow before a long literal, so the literal is
// read from the declaration wherever it wrapped (the same pattern tests/run.js uses).
const listed = /stdModuleNames = \(\): string =>\s*"([^"]*)"/.exec(source)
const names = listed === null ? [] : listed[1].split(", ").filter((name) => name.length > 0)
if (names.length === 0) {
  console.error('std-module-paths: no `stdModuleNames = (): string => "..."` in src/std-modules.ts')
  process.exit(1)
}
console.log(names.map((name) => `std/${name}.ts`).join("\n"))
