#!/usr/bin/env node
/**
 * The `nish-skills` command: review the agent skills of every installed Nish
 * package and link the ones the user accepts into the project's
 * `.claude/skills/`.
 *
 * A skill can grant an agent tools, so installing a package never links one:
 * this command does, and only for a skill accepted at its current hash -- a
 * `y` at the prompt on a terminal, its name on the command line, or `--yes`
 * for a skill that grants nothing. The rules -- which packages qualify, what
 * is hashed and recorded, which entries the linker owns, what it prunes -- are
 * `scripts/link-skills.mjs`'s.
 *
 * A separate node bin rather than a `nish` subcommand on purpose: it is
 * install tooling, and the compiler stays out of it.
 *
 * Exit 0 when it ran, even if some skills were not linked; 2 for a usage
 * error, an unknown skill name, or when no project is found; 1 when a write
 * failed; 130 when Ctrl-C interrupts a question, and then nothing is written.
 * `--help` is usage on stdout and exit 0, whatever else is on the line, the
 * contract `nish --help` keeps.
 */
import fs from "node:fs"
import path from "node:path"
import readline from "node:readline"
import { clean, projectOf, review } from "../scripts/link-skills.mjs"

const USAGE = `Usage: nish-skills [--dir <dir>] [--yes] [<skill>...]

Review the agent skills of every installed Nish package and link the ones you
accept into <dir>/.claude/skills/. A skill is linked only once accepted, and
accepted again whenever its files change: the acceptance is recorded with a
hash of the skill in <dir>/.claude/skills/.nish-skills.json.

On a terminal, with no <skill> and no --yes, each skill not yet accepted is
shown with what it grants and asked about; only y accepts. Otherwise nothing is
asked: a named <skill> is accepted, --yes accepts every skill that grants
nothing, and a skill that grants anything (tools, hooks, a shell command run at
load, or a frontmatter key not known to be inert) is accepted only by name.
Ctrl-C at a question exits 130 and writes nothing.

<dir> defaults to the project this copy of nish is installed in: the current
directory or the nearest ancestor holding a package.json whose node_modules/nish
is this copy (a workspace's root, run from a member), else the nearest ancestor
holding a package.json. Only links that resolve inside <dir>/node_modules/ are
ever replaced or removed; anything else is left alone.

Options:
  --dir <dir>  the project to link skills into
  -y, --yes    accept every skill that grants nothing
  -h, --help   print this and exit

Exit status: 0 ran (some skills may not be linked), 1 a write failed,
2 usage error, unknown skill, or no project, 130 interrupted.
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

/**
 * The arguments as options, or a usage error's message.
 *
 * @param {string[]} args
 * @returns {{ dir: string | null, yes: boolean, names: string[], help: boolean } | string}
 */
const parse = (args) => {
  const options = { dir: null, yes: false, names: [], help: false }
  const end = args.indexOf("--")
  if ((end === -1 ? args : args.slice(0, end)).some((a) => a === "-h" || a === "--help")) {
    // --help wins over anything else on the line, a bad option included.
    return { ...options, help: true }
  }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--") {
      options.names.push(...args.slice(i + 1))
      break
    }
    if (arg === "-h" || arg === "--help") {
      options.help = true
    } else if (arg === "-y" || arg === "--yes") {
      options.yes = true
    } else if (arg === "--dir" || arg.startsWith("--dir=")) {
      const dir = arg === "--dir" ? args[++i] : arg.slice("--dir=".length)
      if (dir === undefined || dir === "") {
        return "--dir needs a directory"
      }
      options.dir = dir
    } else if (arg.startsWith("-")) {
      return `unknown option ${arg}`
    } else {
      options.names.push(arg)
    }
  }
  return options
}

/** Thrown by a question that Ctrl-C interrupted. */
class Interrupted extends Error {}

/**
 * A question asked on the terminal: the answer line, or null at end of input.
 * Ctrl-C rejects it with `Interrupted`.
 */
const terminalAsk = () => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
  const lines = rl[Symbol.asyncIterator]()
  /** @type {{ promise: Promise<never>, reject: (err: Error) => void }} */
  const { promise: interrupted, reject } = Promise.withResolvers()
  interrupted.catch(() => {
    // Handled where a question awaits it; this keeps a Ctrl-C between questions from being unhandled.
  })
  // Without a listener readline only pauses on Ctrl-C, and the question would hang.
  rl.on("SIGINT", () => reject(new Interrupted("interrupted")))
  return {
    ask: async (question) => {
      process.stdout.write(question)
      const next = await Promise.race([lines.next(), interrupted])
      return next.done === true ? null : next.value
    },
    close: () => rl.close(),
  }
}

/** Review and link for the project the arguments name, and report one line per skill. */
const run = async (args) => {
  const options = parse(args)
  if (typeof options === "string") {
    usageError(options)
    return
  }
  if (options.help) {
    process.stdout.write(USAGE)
    return
  }
  let project
  if (options.dir !== null) {
    if (!fs.statSync(options.dir, { throwIfNoEntry: false })?.isDirectory()) {
      usageError(`${options.dir} is not a directory`)
      return
    }
    project = path.resolve(options.dir)
  } else {
    // The rule postinstall uses, so a workspace member links at the root nish
    // was hoisted to; a copy installed nowhere above (npx's cache) falls back.
    project = projectOf(process.cwd(), root) ?? findProject(process.cwd())
    if (project === null) {
      usageError("no package.json in this directory or any above it")
      return
    }
  }
  const interactive =
    options.names.length === 0 &&
    !options.yes &&
    process.stdin.isTTY === true &&
    process.stdout.isTTY === true
  const terminal = interactive ? terminalAsk() : null
  try {
    const { unknown } = await review(project, {
      names: options.names,
      yes: options.yes,
      ask: terminal?.ask ?? null,
    })
    if (unknown.length > 0) {
      const dirs = unknown.filter((n) => fs.statSync(n, { throwIfNoEntry: false })?.isDirectory() === true)
      const hint = dirs.length > 0 ? `; did you mean --dir ${clean(dirs[0], 200)}?` : ""
      usageError(
        `no installed Nish package ships a skill named ${unknown.map((n) => clean(JSON.stringify(n), 200)).join(", ")}${hint}`
      )
    }
  } catch (err) {
    if (err instanceof Interrupted) {
      // Every question is asked before anything is linked, so nothing was written.
      process.stdout.write("\n")
      process.stderr.write("nish-skills: interrupted; nothing was written\n")
      process.exitCode = 130
      return
    }
    process.stderr.write(`nish-skills: ${clean(err instanceof Error ? err.message : String(err), 1000)}\n`)
    process.exitCode = 1
  } finally {
    terminal?.close()
  }
}

await run(process.argv.slice(2))
