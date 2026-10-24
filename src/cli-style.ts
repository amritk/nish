// The compiler's own look on a terminal: whether a stream gets colour, the
// escapes that paint it, and the help text `--help` and a bare `nish` print.
//
// Colour is for a person reading a terminal, and nothing else may see it: a
// script that captures `--help`, a test that compares it, a pipe into `less`
// without `-R` all want the plain bytes. So the default is decided per stream,
// by asking whether that stream is a terminal, and the two conventions people
// already set win over the guess: `NO_COLOR` (https://no-color.org) turns it
// off, and `CLICOLOR_FORCE` or `FORCE_COLOR` turns it on for a pager that
// understands escapes. The plain text is the same bytes either way, which is
// what lets `tests/run.js` compare the help on stdout with the usage on
// stderr.
//
// An agent is a reader of its own kind: it may drive a pseudo-terminal, so the
// terminal check says yes, but every escape is tokens it pays for and reads
// past. `agentDriven` says when one is at the keyboard, and then the help is
// plain, whatever forcing variable its shell inherited, and gains the section
// an agent needs before it writes a line of Nish.
//
// Diagnostics, the one-line hint an unknown flag ends with among them, are not
// painted. Their text is pinned byte for byte by the
// goldens and read by editors and CI logs, and a change to how they look is
// its own decision.

import { CLI, VERSION } from "./branding"
import { repeatString } from "./strings"

/** The Control Sequence Introducer every SGR escape opens with. */
const CSI: string = "\u001b["

/** Where a help row's description starts, counted from the start of the line. */
const DESCRIPTION_COLUMN: i32 = 35

/**
 * How one output stream is painted. `on` says whether to colour at all, and
 * `rich` whether the terminal has the 256-colour palette, which every modern
 * one does and which the softer tones below need; without it each tone falls
 * back to the nearest of the sixteen basic colours.
 */
export class Style {
  on: boolean
  rich: boolean

  constructor(on: boolean, rich: boolean) {
    this.on = on
    this.rich = rich
  }

  /**
   * `text` wrapped in the escape for `code256` (a 256-colour SGR parameter
   * list) or `code16` (an eight-colour one, or faint), and a reset after it; `text` unchanged
   * when colour is off, so a caller never has to ask.
   */
  paint(text: string, code256: string, code16: string): string {
    if (!this.on || text.length === 0) {
      return text
    }
    return `${CSI}${this.rich ? code256 : code16}m${text}${CSI}0m`
  }

  /** A section heading: bold, in the accent. */
  heading(text: string): string {
    return this.paint(text, "1;38;5;213", "1;35")
  }

  /** The tool's own name where it opens a line. */
  name(text: string): string {
    return this.paint(text, "1;38;5;141", "1;35")
  }

  /** A flag, or a command a person would type. */
  flag(text: string): string {
    return this.paint(text, "38;5;117", "36")
  }

  /** A placeholder the person fills in: `<file.ts>`, `speed|size`. */
  meta(text: string): string {
    return this.paint(text, "38;5;222", "33")
  }

  /**
   * Text that explains rather than names: descriptions, notes. Faint rather
   * than bright black on the basic palette, which Solarized makes the background.
   */
  dim(text: string): string {
    return this.paint(text, "38;5;245", "2")
  }
}

/** Whether the environment variable `name` is set to something other than empty. */
const envIsSet = (name: string): boolean => {
  const value = getenv(name)
  return value !== null && value.length > 0
}

/** Whether `value` spells `word`, which is lower case, in any ASCII case. */
const spells = (value: string, word: string): boolean => {
  if (value.length !== word.length) {
    return false
  }
  // Both bounds, though the lengths match: the checker proves an index in range
  // only for a string its loop condition names.
  for (let i = 0; i < value.length && i < word.length; i++) {
    let code = value.charCodeAt(i)
    if (code >= 65 && code <= 90) {
      code = code + 32
    }
    if (code !== word.charCodeAt(i)) {
      return false
    }
  }
  return true
}

/** Whether `value` is a no: `0`, `false`, `no` or `off`, in any case. */
const isNo = (value: string): boolean =>
  value === "0" || spells(value, "false") || spells(value, "no") || spells(value, "off")

/** Whether a variable's `value` is set to a no (`isNo`). */
const saysNo = (value: string | null): boolean => value !== null && isNo(value)

/** Whether a variable's `value` is set and says yes: not empty, and not a no. */
const saysYes = (value: string | null): boolean => value !== null && value.length > 0 && !isNo(value)

/** Whether the variable `name` is set to a no (`saysNo`). */
const envSaysNo = (name: string): boolean => saysNo(getenv(name))

/** Whether the variable `name` says yes (`saysYes`). */
const envSaysYes = (name: string): boolean => saysYes(getenv(name))

/**
 * Whether file descriptor `fd` is a terminal. The language has no `isatty`,
 * and `src/` may only use what the seed compiler already has, so the shell
 * answers: a child inherits the descriptors, and `[ -t 1 ]` is POSIX. It costs
 * one fork, and only on the paths that print the help or the no-inputs usage.
 * Where nothing can be spawned (the WebAssembly build) the answer is "no",
 * which is plain text, the safe side.
 */
const isTerminal = (fd: i32): boolean => spawnSync(["/bin/sh", "-c", `[ -t ${fd} ]`]) === 0

/**
 * Whether an agent, rather than a person, is running the compiler.
 * `NISH_AGENT` answers for any agent: a no (`envSaysNo`) for no, any other
 * value for yes. Without it, the variables the agents that set one put in their commands'
 * environment (Claude Code's `CLAUDECODE`, Gemini CLI's `GEMINI_CLI`) say yes.
 */
export const agentDriven = (): boolean => {
  if (envIsSet("NISH_AGENT")) {
    return !envSaysNo("NISH_AGENT")
  }
  return envSaysYes("CLAUDECODE") || envSaysYes("GEMINI_CLI")
}

/**
 * The style for descriptor `fd` (1 or 2), for a reader `agent` says is an
 * agent or not (`agentDriven`, asked once by the caller). `NO_COLOR` wins,
 * then an agent, then `FORCE_COLOR` saying no (`isNo`; Node reads `0` and
 * `false` so), then a forcing variable, then `CLICOLOR` saying no or
 * `TERM=dumb`, and only then the terminal check. 256 colours when `TERM`
 * names them, `COLORTERM` is set, as truecolour terminals set it, or
 * `FORCE_COLOR` asks for level 2 or 3.
 */
export const styleFor = (fd: i32, agent: boolean): Style => {
  const level = getenv("FORCE_COLOR")
  if (envIsSet("NO_COLOR") || agent || saysNo(level)) {
    return new Style(false, false)
  }
  const term = getenv("TERM")
  const rich =
    (term !== null && term.indexOf("256") >= 0) ||
    envIsSet("COLORTERM") ||
    (level !== null && (level === "2" || level === "3"))
  if (saysYes(level) || envSaysYes("CLICOLOR_FORCE")) {
    return new Style(true, rich)
  }
  if (envSaysNo("CLICOLOR") || (term !== null && term === "dumb")) {
    return new Style(false, false)
  }
  return new Style(isTerminal(fd), rich)
}

/**
 * The spaces that take plain text `width` columns wide to `column`, or two
 * when that would leave fewer, so a long flag still keeps apart from its text.
 */
const padTo = (width: i32, column: i32): string => repeatString(" ", width + 2 <= column ? column - width : 2)

/**
 * One help row: the flag, its placeholder, and what it does, the description
 * starting at `DESCRIPTION_COLUMN`. The padding is counted on the plain text,
 * so the columns line up whether or not the escapes are there.
 */
const helpRow = (style: Style, flag: string, meta: string, description: string): string => {
  const width = 2 + flag.length + (meta.length > 0 ? 1 + meta.length : 0)
  const placeholder = meta.length > 0 ? ` ${style.meta(meta)}` : ""
  return `  ${style.flag(flag)}${placeholder}${padTo(width, DESCRIPTION_COLUMN)}${style.dim(description)}`
}

/** Where a usage line's description starts: past the longest command shape. */
const USAGE_COLUMN: i32 = 46

/**
 * A usage line: the command shape, and what it is for. The first line opens
 * with `usage:` and the rest are indented under it, the padding counted on
 * the plain text as `helpRow`'s is.
 */
const usageRow = (style: Style, first: boolean, shape: string, description: string): string => {
  const lead = first ? `${style.heading("usage:")} ` : repeatString(" ", 7)
  const width = 7 + CLI.length + 1 + shape.length
  const text = description.length > 0 ? `${padTo(width, USAGE_COLUMN)}${style.dim(description)}` : ""
  return `${lead}${style.name(CLI)} ${style.flag(shape)}${text}`
}

/**
 * The help: every flag a user passes -- not `--strict-exports`, which only
 * restates the default, `--nsw`, which is refused, or the test hook
 * `--range-reference` -- grouped by what a person reaches for it to do, one per line, inside 80
 * columns but for an agent's path to the card, as long as the install made
 * it. `--help` prints it on stdout and a bare `nish` on stderr, each styled
 * for its own stream; with colour off the two are the same bytes. `guide`,
 * when it is not empty, is where the rules card is, and adds the section for
 * an agent (`agentDriven`). `tests/run.js` checks its width and its own list
 * of flags; `tests/nish/cli.ts` checks the flags it advertises.
 */
export const helpText = (style: Style, guide: string): string => {
  const lines: string[] = []
  lines.push(
    `${style.name(CLI)} ${style.dim(VERSION)}  ${style.dim("a static subset of TypeScript, compiled ahead of time")}`
  )
  lines.push("")
  lines.push(usageRow(style, true, "<file.ts> [more.ts ...] [flags]", "compile to LLVM IR"))
  lines.push(usageRow(style, false, "run [flags] <file.ts> [args ...]", "build, cache and run it"))
  lines.push(usageRow(style, false, "-v, --version | -h, --help", ""))

  lines.push("")
  lines.push(style.heading("Build"))
  lines.push(
    helpRow(style, "-o, --output", "<file.ll>|<dir>/", "where the IR goes; a dir gets one per module")
  )
  lines.push(helpRow(style, "--link", "<exe>", "link a native binary; the entry exports main"))
  lines.push(helpRow(style, "--profile", "speed|size|debug|wasi", "the link recipe; speed is -O3 with LTO"))
  lines.push(helpRow(style, "--cpu", "x86-64-v3", "allow AVX2; such a binary needs it to start"))
  lines.push(helpRow(style, "--target", "<triple>|host", "stamp the IR with a target's data layout"))
  lines.push(helpRow(style, "-g", "", "DWARF debug info, for gdb and lldb"))
  lines.push(helpRow(style, "--threads", "", "an arena per thread, for --emit-napi-async"))

  lines.push("")
  lines.push(style.heading("Check"))
  lines.push(helpRow(style, "--fix", "", "apply the safe fixes in place, then recheck"))
  lines.push(helpRow(style, "--json", "", "each diagnostic as one JSON line on stdout"))
  lines.push(helpRow(style, "--warn-portability", "", "warn where TypeScript would answer otherwise"))
  lines.push(helpRow(style, "--no-warn-performance", "", "silence the performance warnings"))
  lines.push(helpRow(style, "--deny-panics", "", "refuse an unproven panic in your package"))
  lines.push(helpRow(style, "--deny-retention", "", "refuse retained arena memory in your package"))

  lines.push("")
  lines.push(style.heading("Capabilities"))
  lines.push(helpRow(style, "--capabilities", "", "print what the program can reach, on stderr"))
  lines.push(helpRow(style, "--allow", "<cap>[,<cap>...]", "refuse a program that reaches more"))
  lines.push(helpRow(style, "--deny", "<cap>[,<cap>...]", "refuse a program that reaches these"))
  lines.push(helpRow(style, "--sandbox[=best-effort]", "", "confine a Linux binary to what main reaches"))
  lines.push(helpRow(style, "--emit-capabilities", "<file.json>", "write the capability report"))

  lines.push("")
  lines.push(style.heading("Interop"))
  lines.push(helpRow(style, "--emit-header", "<file.h>", "a C header for the exports"))
  lines.push(helpRow(style, "--emit-dts", "<file.d.ts>", "their typings, and a <file>.mjs loader"))
  lines.push(helpRow(style, "--emit-napi", "<shim.c>", "a Node-API shim, to load them from Node"))
  lines.push(helpRow(style, "--emit-napi-async", "<shim.c>", "the same, plus a promise for each export"))
  lines.push(helpRow(style, "--emit-ts", "<dir>", "the program as TypeScript, instead of IR"))

  lines.push("")
  lines.push(style.heading("Inspect"))
  lines.push(helpRow(style, "--emit-ast", "", "print the parse tree, one line per node"))
  lines.push(helpRow(style, "--emit-checked", "", "print what the checker recorded"))
  lines.push(helpRow(style, "--emit-panics", "<file.json>", "list every place the program can panic"))
  lines.push(helpRow(style, "--emit-arena", "<file.json>", "write the arena retention report"))

  lines.push("")
  lines.push(style.heading("Code generation"))
  lines.push(helpRow(style, "--number-mode", "i32|f64", "what a bare number is; i32 by default"))
  lines.push(helpRow(style, "--plain", "", "the IR without LLVM's attributes"))
  lines.push(helpRow(style, "--no-strict-exports", "", "keep every function externally visible"))
  lines.push(helpRow(style, "--no-stack-alloc", "", "keep every value off the stack"))
  lines.push(helpRow(style, "--runtime-decls", "", "declare the runtime even when unused"))
  lines.push(helpRow(style, "--unchecked-indexing", "", "deprecated: use nish:unsafe"))
  lines.push(helpRow(style, "--wrapping", "", "deprecated: use nish:unsafe"))

  if (guide.length > 0) {
    lines.push("")
    lines.push(style.heading("Agents"))
    lines.push(`  ${style.dim("before writing Nish, read the language as rules, traps first:")}`)
    lines.push(`  ${style.meta(guide)}`)
    lines.push(helpRow(style, "--json", "", "diagnostics as JSON lines, fixes included"))
    lines.push(helpRow(style, "--fix", "", "apply those fixes; read only what is left"))
    lines.push(helpRow(style, `${CLI} run <file.ts>`, "", "what the program prints, once it compiles"))
  }

  lines.push("")
  lines.push(style.heading("Exit codes"))
  lines.push(`  ${style.dim("0 ok, 1 rejected, 2 usage, 3 toolchain, 70 a compiler bug: report it")}`)

  lines.push("")
  lines.push(style.heading("Examples"))
  lines.push(helpRow(style, `${CLI} run hello.ts`, "", "build, cache and run a program"))
  lines.push(helpRow(style, `${CLI} app.ts --link app`, "", "write app.ll and a binary, app"))
  lines.push(helpRow(style, `${CLI} --fix src/*.ts`, "", "rewrite what the compiler can fix"))
  lines.push(helpRow(style, `NO_COLOR=1 ${CLI} --help`, "", "this text, without colour"))
  return lines.join("\n")
}

/**
 * What an unknown flag's refusal ends with, in place of the whole help: the
 * refusal is the news, and the help is one command away. Plain, as every
 * diagnostic is.
 */
export const helpHint = (): string => `run \`${CLI} --help\` for the flags`
