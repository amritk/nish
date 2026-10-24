/**
 * `std/cli` — a command-line tool's help menu: whether a stream gets colour,
 * the escapes that paint it, and the rows a `--help` is made of.
 *
 *     import { HelpMenu, agentDriven, styleFor } from "nish/cli";
 *
 *     const menu = new HelpMenu(styleFor(1, agentDriven()), "greet", 30, 40);
 *     menu.header("1.0.0", "say hello");
 *     menu.usage("<name> [flags]", "greet someone");
 *     menu.section("Flags");
 *     menu.row("--shout", "", "in capitals");
 *     menu.row("--times", "<n>", "say it n times");
 *     console.log(menu.text());
 *
 * **The terminal's own colours.** A `Style` paints with the eight basic SGR
 * colours, bold and faint, never a fixed RGB or 256-palette tone. Every theme
 * redefines those eight, so the menu comes out in whatever palette the reader
 * chose, and a terminal with no theme set paints them in its built-in
 * defaults. A terminal with no colours at all (`tput colors` says fewer than
 * eight) gets the failsafe: the same structure in bold and underline, which a
 * monochrome terminal still shows.
 *
 * **Colour is for a person reading a terminal**, and nothing else may see it:
 * a script that captures `--help`, a test that compares it, a pipe into `less`
 * without `-R` all want the plain bytes. So `styleFor` decides per stream, by
 * asking whether that stream is a terminal, and the conventions people already
 * set win over the guess: `NO_COLOR` (https://no-color.org) turns it off, and
 * `CLICOLOR_FORCE` or `FORCE_COLOR` turns it on for a pager that understands
 * escapes. The plain text is the same bytes either way, and a row's padding is
 * counted on the plain text, so the columns line up with or without escapes.
 *
 * **An agent is a reader of its own kind**: it may drive a pseudo-terminal, so
 * the terminal check says yes, but every escape is tokens it pays for and
 * reads past. `agentDriven` says when one is at the keyboard, and `styleFor`
 * is then plain whatever forcing variable its shell inherited.
 *
 * **What it reaches.** `Style` and `HelpMenu` reach no capability. `styleFor`
 * reads the environment and forks a shell once (`env` and `process.spawn`),
 * and `agentDriven` reads the environment; a program that builds its `Style`
 * by hand reaches neither.
 *
 * **The compiler's own help is built with it**, through a relative import from
 * `src/cli-style.ts`, so this file is compiled by the last release as part of
 * the compiler: it may use only what that release compiles (the rolling
 * freeze, `.claude/selfhost.md`), which is why it asks the shell whether a
 * descriptor is a terminal rather than calling `nish:term`'s `isTerminal`.
 */

/** The Control Sequence Introducer every SGR escape opens with. */
const CSI: string = "\u001b["

/** `paletteOf`'s answer: marked up in the theme's colours. */
const PALETTE_THEME: i32 = 0

/** `paletteOf`'s answer: marked up in attributes only, the failsafe. */
const PALETTE_MONO: i32 = 2

/**
 * How one output stream is painted. `on` says whether to mark the text up at
 * all, and `colour` whether the terminal has colours to mark it up with;
 * without them each mark falls back to bold, underline or nothing.
 */
export class Style {
  on: boolean
  colour: boolean

  constructor(on: boolean, colour: boolean) {
    this.on = on
    this.colour = colour
  }

  /**
   * `text` wrapped in the escape for `themed` (an SGR parameter list in the
   * theme's basic colours) or `mono` (attributes only), and a reset after it;
   * `text` unchanged when marking up is off or the chosen list is empty, so a
   * caller never has to ask.
   */
  paint(text: string, themed: string, mono: string): string {
    const code = this.colour ? themed : mono
    if (!this.on || text.length === 0 || code.length === 0) {
      return text
    }
    return `${CSI}${code}m${text}${CSI}0m`
  }

  /** A section heading: bold, in the theme's magenta. */
  heading(text: string): string {
    return this.paint(text, "1;35", "1")
  }

  /** The tool's own name where it opens a line. */
  name(text: string): string {
    return this.paint(text, "1;35", "1")
  }

  /** A flag, or a command a person would type. */
  flag(text: string): string {
    return this.paint(text, "36", "1")
  }

  /** A placeholder the person fills in: `<file.ts>`, `speed|size`. */
  meta(text: string): string {
    return this.paint(text, "33", "4")
  }

  /**
   * Text that explains rather than names: descriptions, notes. Faint rather
   * than bright black, which Solarized makes the background; plain without
   * colour, where the bold flags already stand apart from it.
   */
  dim(text: string): string {
    return this.paint(text, "2", "")
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
  for (let i: i32 = 0; i < toI32(value.length) && i < toI32(word.length); i++) {
    let code: i32 = toI32(value.charCodeAt(i))
    if (code >= 65 && code <= 90) {
      code = code + 32
    }
    if (code !== toI32(word.charCodeAt(i))) {
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
 * What descriptor `fd` can show: `PALETTE_THEME`, `PALETTE_MONO`, or anything
 * else for plain text. The shell answers: a child inherits the descriptors and
 * the environment, `[ -t 1 ]` is POSIX, and `tput colors` reads the count
 * `TERM`'s terminfo entry declares (`-1` for none). With `terminal` unset
 * (colour was forced) only the count is asked. `tput` is run by absolute path,
 * never looked up on `PATH`, so a `PATH` with `.` in it cannot run a `tput`
 * planted in the working directory (`docs/security/cli.md`). When there is no
 * `tput` there, or it does not know `TERM`, the answer is the theme: almost
 * every terminal has colours, and an escape a monochrome one does not know it
 * drops. It costs one fork. Where nothing can be spawned (a WebAssembly build)
 * the answer is `-1`, which is plain text, the safe side.
 */
const paletteOf = (fd: i32, terminal: boolean): i32 => {
  const tty = terminal ? `[ -t ${fd} ] || exit 1; ` : ""
  const find = "t=/usr/bin/tput; [ -x $t ] || t=/bin/tput; [ -x $t ] || exit 0; "
  const count = "c=$($t colors 2>/dev/null) || exit 0; case $c in ''|*[!0-9-]*) exit 0;; esac; "
  return toI32(spawnSync(["/bin/sh", "-c", `${tty}${find}${count}[ "$c" -ge 8 ] || exit ${PALETTE_MONO}`]))
}

/** The style for a `paletteOf` answer: the theme, the failsafe, or plain. */
const styleOfPalette = (palette: i32): Style => {
  if (palette === PALETTE_THEME) {
    return new Style(true, true)
  }
  return new Style(palette === PALETTE_MONO, false)
}

/**
 * Whether an agent, rather than a person, is running the program.
 * `NISH_AGENT` answers for any agent: a no (`envSaysNo`) for no, any other
 * value for yes. Without it, the variables the agents that set one put in
 * their commands' environment (Claude Code's `CLAUDECODE`, Gemini CLI's
 * `GEMINI_CLI`) say yes.
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
 * `TERM=dumb`, and only then the terminal check. Whichever way it is on, the
 * colours `TERM` declares choose between the theme and the failsafe
 * (`paletteOf`).
 */
export const styleFor = (fd: i32, agent: boolean): Style => {
  const level = getenv("FORCE_COLOR")
  if (envIsSet("NO_COLOR") || agent || saysNo(level)) {
    return new Style(false, false)
  }
  if (saysYes(level) || envSaysYes("CLICOLOR_FORCE")) {
    return styleOfPalette(paletteOf(fd, false))
  }
  const term = getenv("TERM")
  if (envSaysNo("CLICOLOR") || (term !== null && term === "dumb")) {
    return new Style(false, false)
  }
  return styleOfPalette(paletteOf(fd, true))
}

/** `count` spaces, or none when `count` is not positive. */
const spaces = (count: i32): string => {
  const out: string[] = []
  for (let i: i32 = 0; i < count; i++) {
    out.push(" ")
  }
  return out.join("")
}

/**
 * The spaces that take plain text `width` columns wide to `column`, or two
 * when that would leave fewer, so a long flag still keeps apart from its text.
 */
const padTo = (width: i32, column: i32): string => spaces(width + 2 <= column ? column - width : 2)

/**
 * A help menu, built a line at a time and answered whole by `text`. Rows are
 * indented two columns and their descriptions start at `column`; usage lines'
 * descriptions start at `usageColumn`, past the longest command shape. Every
 * width is counted on the plain text, one column a byte, so the columns line
 * up whether or not `style` paints, as long as the text is ASCII.
 */
export class HelpMenu {
  style: Style
  program: string
  column: i32
  usageColumn: i32
  lines: string[]
  usages: i32

  constructor(style: Style, program: string, column: i32, usageColumn: i32) {
    this.style = style
    this.program = program
    this.column = column
    this.usageColumn = usageColumn
    this.lines = []
    this.usages = 0
  }

  /** The opening line, the program's name, `version` and a one-line `summary`, and a blank after it. */
  header(version: string, summary: string): void {
    const style = this.style
    this.lines.push(`${style.name(this.program)} ${style.dim(version)}  ${style.dim(summary)}`)
    this.lines.push("")
  }

  /**
   * A usage line: the command `shape` after the program's name, and what it
   * is for (`description` may be empty). The first opens with `usage:` and
   * the rest are indented under it.
   */
  usage(shape: string, description: string): void {
    const style = this.style
    const lead = this.usages === 0 ? `${style.heading("usage:")} ` : spaces(7)
    const width: i32 = 8 + toI32(this.program.length) + toI32(shape.length)
    const text = description.length > 0 ? `${padTo(width, this.usageColumn)}${style.dim(description)}` : ""
    this.lines.push(`${lead}${style.name(this.program)} ${style.flag(shape)}${text}`)
    this.usages = this.usages + 1
  }

  /** A section: a blank line, then `title` as a heading. */
  section(title: string): void {
    this.lines.push("")
    this.lines.push(this.style.heading(title))
  }

  /**
   * One row: the `flag` (or a command), its placeholder `meta` (may be
   * empty), and what it does, the description starting at `column`.
   */
  row(flag: string, meta: string, description: string): void {
    const style = this.style
    const width: i32 = 2 + toI32(flag.length) + (meta.length > 0 ? 1 + toI32(meta.length) : 0)
    const placeholder = meta.length > 0 ? ` ${style.meta(meta)}` : ""
    this.lines.push(
      `  ${style.flag(flag)}${placeholder}${padTo(width, this.column)}${style.dim(description)}`
    )
  }

  /** An indented line of prose, faint. */
  note(text: string): void {
    this.lines.push(`  ${this.style.dim(text)}`)
  }

  /** An indented line the reader fills in or opens, a path or a value, as a placeholder. */
  value(text: string): void {
    this.lines.push(`  ${this.style.meta(text)}`)
  }

  /** The menu so far, its lines joined by newlines, with no newline after the last. */
  text(): string {
    return this.lines.join("\n")
  }
}
