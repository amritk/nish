#!/usr/bin/env node
/**
 * The `nish-skills` command: link the agent skills of every installed Nish
 * package into the project's `.claude/skills/`.
 *
 * `nish`'s own postinstall links its skills when nish is installed, but a
 * postinstall cannot run when *another* package is installed, so a Nish
 * library added later needs this. The rules -- which packages qualify, which
 * entries the linker owns, what it prunes -- are `scripts/link-skills.mjs`'s.
 *
 * A separate node bin rather than a `nish` subcommand on purpose: it is
 * install tooling, and the compiler stays out of it.
 *
 * Exit 0 when it ran, even if some names were skipped; 2 for a usage error or
 * when no project is found; 1 when a write failed. `--help` is usage on stdout
 * and exit 0, the contract `nish --help` keeps.
 */
import fs from "node:fs"
import path from "node:path"
import { linkSkills, projectOf } from "../scripts/link-skills.mjs"

const USAGE = `Usage: nish-skills [dir]

Link the agent skills of every installed Nish package into <dir>/.claude/skills/.
<dir> defaults to the project this copy of nish is installed in: the current
directory or the nearest ancestor holding a package.json whose node_modules/nish
is this copy (a workspace's root, run from a member), else the nearest ancestor
holding a package.json.

A package ships a skill as skills/<name>/SKILL.md. Only links that resolve inside
<dir>/node_modules/ are ever replaced or removed; anything else is left alone.

Options:
  -h, --help  print this and exit

Exit status: 0 ran (some names may be skipped), 1 a write failed, 2 usage error or no project.
`

/** Print a usage error and set exit 2. */
const usageError = (message) => {
  process.stderr.write(`nish-skills: ${message}\n${USAGE}`)
  process.exitCode = 2
}

/** This package's root: the directory holding `bin/` and `scripts/`. */
const root = path.resolve(import.meta.dirname, "..")

/** The nearest directory from `start` upwards that holds a `package.json`, or null. */
const findProject = (start) => {
  for (let dir = path.resolve(start); ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir
    }
    if (path.dirname(dir) === dir) {
      return null
    }
  }
}

/** Link for the project the arguments name, and report one line per name. */
const run = (args) => {
  if (args.includes("-h") || args.includes("--help")) {
    process.stdout.write(USAGE)
    return
  }
  const flag = args.find((a) => a.startsWith("-"))
  if (flag !== undefined) {
    usageError(`unknown option ${flag}`)
    return
  }
  if (args.length > 1) {
    usageError("takes at most one directory")
    return
  }
  let project
  if (args.length === 1) {
    if (!fs.statSync(args[0], { throwIfNoEntry: false })?.isDirectory()) {
      usageError(`${args[0]} is not a directory`)
      return
    }
    project = path.resolve(args[0])
  } else {
    // The rule postinstall uses, so a workspace member links at the root nish
    // was hoisted to; a copy installed nowhere above (npx's cache) falls back.
    project = projectOf(process.cwd(), root) ?? findProject(process.cwd())
    if (project === null) {
      usageError("no package.json in this directory or any above it")
      return
    }
  }
  let result
  try {
    result = linkSkills(project)
  } catch (err) {
    process.stderr.write(`nish-skills: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exitCode = 1
    return
  }
  for (const name of result.linked) {
    console.log(`linked  ${name}`)
  }
  for (const name of result.pruned) {
    console.log(`pruned  ${name}`)
  }
  for (const { name, reason } of result.skipped) {
    console.log(`skipped ${name}: ${reason}`)
  }
  console.log(
    `nish-skills: ${result.linked.length} linked, ${result.kept.length} unchanged, ${result.pruned.length} pruned, ${result.skipped.length} skipped in ${project}`
  )
}

run(process.argv.slice(2))
