// The compiler's own help: the text `--help` and a bare `nish` print. How it
// is painted, and whether it is painted at all, is the standard library's
// `std/cli.ts` (`styleFor`, `agentDriven`, `HelpMenu`), imported by a relative
// path so the last release can compile it as part of the compiler.
//
// An agent gets the plain help and the section it needs before it writes a
// line of Nish (`guide`).
//
// Diagnostics, the one-line hint an unknown flag ends with among them, are not
// painted. Their text is pinned byte for byte by the
// goldens and read by editors and CI logs, and a change to how they look is
// its own decision.

import { HelpMenu, Style } from "../std/cli"
import { CLI, VERSION } from "./branding"

/** Where a help row's description starts, counted from the start of the line. */
const DESCRIPTION_COLUMN: i32 = 35

/** Where a usage line's description starts: past the longest command shape. */
const USAGE_COLUMN: i32 = 46

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
  const menu = new HelpMenu(style, CLI, DESCRIPTION_COLUMN, USAGE_COLUMN)
  menu.header(VERSION, "a static subset of TypeScript, compiled ahead of time")
  menu.usage("<file.ts> [more.ts ...] [flags]", "compile to LLVM IR")
  menu.usage("run [flags] <file.ts> [args ...]", "build, cache and run it")
  menu.usage("-v, --version | -h, --help", "")

  menu.section("Build")
  menu.row("-o, --output", "<file.ll>|<dir>/", "where the IR goes; a dir gets one per module")
  menu.row("--link", "<exe>", "link a native binary; the entry exports main")
  menu.row("--profile", "speed|size|debug|wasi", "the link recipe; speed is -O3 with LTO")
  menu.row("--cpu", "x86-64-v3", "allow AVX2; such a binary needs it to start")
  menu.row("--target", "<triple>|host", "stamp the IR with a target's data layout")
  menu.row("-g", "", "DWARF debug info, for gdb and lldb")
  menu.row("--threads", "", "an arena per thread, for --emit-napi-async")

  menu.section("Check")
  menu.row("--fix", "", "apply the safe fixes in place, then recheck")
  menu.row("--json", "", "each diagnostic as one JSON line on stdout")
  menu.row("--warn-portability", "", "warn where TypeScript would answer otherwise")
  menu.row("--no-warn-performance", "", "silence the performance warnings")
  menu.row("--deny-panics", "", "refuse an unproven panic in your package")
  menu.row("--deny-retention", "", "refuse retained arena memory in your package")

  menu.section("Capabilities")
  menu.row("--capabilities", "", "print what the program can reach, on stderr")
  menu.row("--allow", "<cap>[,<cap>...]", "refuse a program that reaches more")
  menu.row("--deny", "<cap>[,<cap>...]", "refuse a program that reaches these")
  menu.row("--sandbox[=best-effort]", "", "confine a Linux binary to what main reaches")
  menu.row("--emit-capabilities", "<file.json>", "write the capability report")

  menu.section("Interop")
  menu.row("--emit-header", "<file.h>", "a C header for the exports")
  menu.row("--emit-dts", "<file.d.ts>", "their typings, and a <file>.mjs loader")
  menu.row("--emit-napi", "<shim.c>", "a Node-API shim, to load them from Node")
  menu.row("--emit-napi-async", "<shim.c>", "the same, plus a promise for each export")
  menu.row("--emit-ts", "<dir>", "the program as TypeScript, instead of IR")

  menu.section("Inspect")
  menu.row("--emit-ast", "", "print the parse tree, one line per node")
  menu.row("--emit-checked", "", "print what the checker recorded")
  menu.row("--emit-panics", "<file.json>", "list every place the program can panic")
  menu.row("--emit-arena", "<file.json>", "write the arena retention report")

  menu.section("Code generation")
  menu.row("--number-mode", "i32|f64", "what a bare number is; i32 by default")
  menu.row("--plain", "", "the IR without LLVM's attributes")
  menu.row("--no-strict-exports", "", "keep every function externally visible")
  menu.row("--no-stack-alloc", "", "keep every value off the stack")
  menu.row("--runtime-decls", "", "declare the runtime even when unused")
  menu.row("--unchecked-indexing", "", "deprecated: use nish:unsafe")
  menu.row("--wrapping", "", "deprecated: use nish:unsafe")

  if (guide.length > 0) {
    menu.section("Agents")
    menu.note("before writing Nish, read the language as rules, traps first:")
    menu.value(guide)
    menu.row("--json", "", "diagnostics as JSON lines, fixes included")
    menu.row("--fix", "", "apply those fixes; read only what is left")
    menu.row(`${CLI} run <file.ts>`, "", "what the program prints, once it compiles")
  }

  menu.section("Exit codes")
  menu.note("0 ok, 1 rejected, 2 usage, 3 toolchain, 70 a compiler bug: report it")

  menu.section("Examples")
  menu.row(`${CLI} run hello.ts`, "", "build, cache and run a program")
  menu.row(`${CLI} app.ts --link app`, "", "write app.ll and a binary, app")
  menu.row(`${CLI} --fix src/*.ts`, "", "rewrite what the compiler can fix")
  menu.row(`NO_COLOR=1 ${CLI} --help`, "", "this text, without colour")
  return menu.text()
}

/**
 * What an unknown flag's refusal ends with, in place of the whole help: the
 * refusal is the news, and the help is one command away. Plain, as every
 * diagnostic is.
 */
export const helpHint = (): string => `run \`${CLI} --help\` for the flags`
