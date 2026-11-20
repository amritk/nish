#!/usr/bin/env node
// Vendor the shared Claude Code skills and agents from amritk/ai into
// `.claude/skills/` and `.claude/agents/`, and check that the copies are
// unedited.
//
//   node scripts/sync-skills.mjs --check        every vendored file matches the manifest
//   node scripts/sync-skills.mjs --from <dir>   copy from a checkout of amritk/ai
//   node scripts/sync-skills.mjs                clone amritk/ai's main and copy from it
//   node scripts/sync-skills.mjs --ref <ref>    ...at that branch, tag or commit
//
// The skills live in amritk/ai so every repo shares one copy. A nish session
// does not have that repo linked, so the ones nish uses are copied here. The
// manifest, `.claude/vendored-skills.json`, names the skills and agents to
// copy, the commit they came from and every file's SHA-256. `--check` fails on
// any vendored file that differs from its hash, is missing, or is not in the
// manifest, so a fix to a shared skill goes to amritk/ai first and comes back
// through a sync, never as an edit here that the next sync would erase. To
// vendor another skill, add its name to the manifest's `skills` list and sync.
import { execFileSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

const root = path.resolve(import.meta.dirname, "..")
const manifestPath = path.join(root, ".claude", "vendored-skills.json")
const args = process.argv.slice(2)
const flag = (name) => {
  const at = args.indexOf(name)
  return at >= 0 ? args[at + 1] : undefined
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))

/** Every file under `dir`, as paths relative to `base`, sorted. */
const walk = (base, dir) => {
  const full = path.join(base, dir)
  if (!fs.existsSync(full)) {
    return []
  }
  const out = []
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) {
      out.push(...walk(base, rel))
    } else {
      out.push(rel)
    }
  }
  return out.sort()
}

/** The vendored paths, relative to the repository root, for one tree. */
const vendored = (base) => [
  ...manifest.skills.flatMap((name) => walk(base, `.claude/skills/${name}`)),
  ...manifest.agents.map((name) => `.claude/agents/${name}.md`).filter((rel) => fs.existsSync(path.join(base, rel))),
]

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")

if (args.includes("--check")) {
  const problems = []
  const recorded = manifest.files ?? {}
  const present = new Set(vendored(root))
  for (const [rel, hash] of Object.entries(recorded)) {
    if (!present.has(rel)) {
      problems.push(`${rel}: missing`)
    } else if (sha256(path.join(root, rel)) !== hash) {
      problems.push(`${rel}: edited since the sync from amritk/ai@${manifest.commit.slice(0, 12)}`)
    }
  }
  for (const rel of present) {
    if (!(rel in recorded)) {
      problems.push(`${rel}: not in the manifest`)
    }
  }
  if (problems.length > 0) {
    console.error(problems.join("\n"))
    console.error("Change shared skills in amritk/ai, then run node scripts/sync-skills.mjs to bring them back.")
    process.exit(1)
  }
  console.log(`${present.size} vendored files match amritk/ai@${manifest.commit.slice(0, 12)}`)
  process.exit(0)
}

let source = flag("--from")
let cleanup
if (!source) {
  cleanup = fs.mkdtempSync(path.join(os.tmpdir(), "nish-skills-"))
  source = cleanup
  execFileSync("git", ["clone", "--quiet", `https://github.com/${manifest.source}.git`, source], {
    stdio: "inherit",
  })
  const ref = flag("--ref")
  if (ref) {
    execFileSync("git", ["-C", source, "checkout", "--quiet", ref], { stdio: "inherit" })
  }
}
source = path.resolve(source)

try {
  const wanted = vendored(source)
  for (const name of manifest.skills) {
    if (!fs.existsSync(path.join(source, ".claude/skills", name, "SKILL.md"))) {
      throw new Error(`${manifest.source} has no skill named ${name}`)
    }
  }
  for (const name of manifest.agents) {
    if (!fs.existsSync(path.join(source, ".claude/agents", `${name}.md`))) {
      throw new Error(`${manifest.source} has no agent named ${name}`)
    }
  }
  // Remove what the last sync wrote, so a file dropped upstream goes here too.
  for (const rel of Object.keys(manifest.files ?? {})) {
    fs.rmSync(path.join(root, rel), { force: true })
  }
  const files = {}
  for (const rel of wanted) {
    const to = path.join(root, rel)
    fs.mkdirSync(path.dirname(to), { recursive: true })
    fs.copyFileSync(path.join(source, rel), to)
    files[rel] = sha256(to)
  }
  manifest.commit = execFileSync("git", ["-C", source, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  manifest.files = files
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`vendored ${wanted.length} files from ${manifest.source}@${manifest.commit.slice(0, 12)}`)
} finally {
  if (cleanup) {
    fs.rmSync(cleanup, { recursive: true, force: true })
  }
}
