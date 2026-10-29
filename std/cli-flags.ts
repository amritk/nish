/**
 * `std/cli-flags` — a command line's flags, declared once as data and read
 * back by name, with the same declaration writing the `--help` rows.
 *
 *     import { FlagTable } from "nish/cli-flags";
 *
 *     const flags = new FlagTable("git-lite");
 *     flags.command("remote add", "<name> <url>", "add a remote");
 *     flags.string("output", "<file>", "where to write");
 *     flags.number("jobs", "<n>", "parallel jobs");
 *     flags.boolean("verbose", "say more");
 *     flags.repeatable("include", "<dir>", "search here too");
 *     const got = flags.parseFrom(process.argv, 1);
 *     if (!got.ok) { got.exitUsage(); }
 *     got.command;                      // "remote add", or "" for none
 *     got.str("output"); got.num("jobs"); got.bool("verbose"); got.all("include");
 *
 * **No function values.** A flag is a name, a kind, a placeholder and a line
 * of help, and the program asks the parse for a value by name afterwards, so
 * the table is plain data the help menu can read too (`writeHelp`).
 *
 * **The grammar** is the GNU long-option one without the short options:
 * `--name value` and `--name=value` for a string, number or repeatable flag,
 * `--name` and `--no-name` for a boolean, `--` ending the flags, and a lone
 * `-` an ordinary word. Words that are not flags may come before, between or
 * after them; the leading ones choose the command, the longest declared path
 * they spell, and the rest are positionals. A flag belongs to the whole table,
 * not to one command: a program that wants `--force` only under `remote add`
 * checks `command` itself.
 *
 * **A usage error is an answer, not a panic.** `parse` stops at the first one
 * and the result carries it as data (`code`, `message`, `argument`), so a
 * program can test it or word it its own way; `exitUsage` is the usual
 * ending, the message on stderr and exit status 2, the convention `nish`
 * itself keeps. Asking for a flag the table does not declare, or as the wrong
 * kind, is a bug in the program rather than in its command line, and panics.
 *
 * **What it reaches.** Nothing but `exitUsage`, which reaches `exit`.
 */
import { HelpMenu } from "nish/cli"
import { splitWhitespace } from "nish/text"

/** A flag that takes one value, read with `str`. */
export const FLAG_STRING: i32 = 0

/** A flag whose one value is a number, read with `num`. */
export const FLAG_NUMBER: i32 = 1

/** A flag that takes no value: `--name` is true and `--no-name` false, read with `bool`. */
export const FLAG_BOOLEAN: i32 = 2

/** A flag that takes a value each time it is given, every one kept in order, read with `all`. */
export const FLAG_REPEATABLE: i32 = 3

/** `ParsedFlags.code` for a parse with no usage error. */
export const FLAG_OK: i32 = 0

/** A `--name` the table does not declare, or a short option (`-v`), which the grammar does not have. */
export const FLAG_ERR_UNKNOWN: i32 = 1

/** A flag that takes a value, last on the line with no `=`. */
export const FLAG_ERR_MISSING_VALUE: i32 = 2

/** A number flag's value that is not one finite number. */
export const FLAG_ERR_NOT_A_NUMBER: i32 = 3

/** A flag that is not repeatable, given a second time (for a boolean, in either spelling). */
export const FLAG_ERR_REPEATED: i32 = 4

/** `--name=value` (or `--no-name=value`) on a boolean. */
export const FLAG_ERR_BOOLEAN_VALUE: i32 = 5

/** Leading words that spell no declared command, when the table declares any. */
export const FLAG_ERR_UNKNOWN_COMMAND: i32 = 6

/** One declared flag: its name without the `--`, its `FLAG_*` kind and its help. */
export class FlagSpec {
  name: string
  kind: i32
  meta: string
  description: string

  constructor(name: string, kind: i32, meta: string, description: string) {
    this.name = name
    this.kind = kind
    this.meta = meta
    this.description = description
  }
}

/**
 * One declared command: its `path` as the words a person types, those words
 * split once so that matching does not split them per parse, and its help.
 */
export class CommandSpec {
  path: string
  words: string[]
  shape: string
  description: string

  constructor(path: string, words: string[], shape: string, description: string) {
    this.path = path
    this.words = words
    this.shape = shape
    this.description = description
  }
}

/** Whether `path` and `words` agree on their first `count` words; both have at least that many. */
const agrees = (path: string[], words: string[], count: i32): boolean => {
  for (let i: i32 = 0; i < count && i < toI32(path.length) && i < toI32(words.length); i++) {
    if (path[i] !== words[i]) {
      return false
    }
  }
  return true
}

/**
 * Whether `text` is a decimal number in the one syntax every target reads
 * alike: an optional sign, digits with an optional `.` fraction (one digit at
 * least), then an optional `e` exponent with its own sign, ASCII only.
 * `Number` alone reads more, and not the same more natively as under Node
 * (`0x1A`, `0b11`, padding, `""` as zero), so a number flag asks this first.
 */
const isDecimal = (text: string): boolean => {
  // 0 before anything, 1 in the digits, 2 in the fraction, 3 just after
  // the `e`, 4 in the exponent.
  let state: i32 = 0
  let mantissa: i32 = 0
  let exponent: i32 = 0
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    const c = toI32(text.charCodeAt(i))
    if (c >= 48 && c <= 57) {
      if (state >= 3) {
        exponent = exponent + 1
        state = 4
      } else {
        mantissa = mantissa + 1
        state = state === 0 ? toI32(1) : state
      }
    } else if ((c === 43 || c === 45) && (state === 0 || state === 3)) {
      state = state + 1
    } else if (c === 46 && state <= 1) {
      state = 2
    } else if ((c === 101 || c === 69) && (state === 1 || state === 2) && mantissa > 0) {
      state = 3
    } else {
      return false
    }
  }
  return mantissa > 0 && (state < 3 || exponent > 0)
}

/** Whether `name` can follow `--` and be matched: not empty, no leading `-`, and no `=`, space or control byte. */
const isFlagName = (name: string): boolean => {
  if (name.length === 0 || name.startsWith("-")) {
    return false
  }
  for (let i: i32 = 0; i < toI32(name.length); i++) {
    const c = toI32(name.charCodeAt(i))
    if (c <= 32 || c === 61) {
      return false
    }
  }
  return true
}

/**
 * The flags and commands of one program, declared in the order its help
 * lists them. Each declaring method panics on a name no command line could
 * match (empty, a leading `-`, an `=` or whitespace in a flag name), one
 * declared twice, or a `no-x` beside a boolean `x`, because the table is the
 * program's own text and a mistake there is a bug.
 */
export class FlagTable {
  program: string
  flags: FlagSpec[]
  commands: CommandSpec[]

  constructor(program: string) {
    this.program = program
    this.flags = []
    this.commands = []
  }

  /** The index of the flag `name` (without `--`), or `-1`. */
  indexOf(name: string): i32 {
    for (let i: i32 = 0; i < toI32(this.flags.length); i++) {
      if (this.flags[i].name === name) {
        return i
      }
    }
    return -1
  }

  /** A flag of `kind`, after the checks every declaring method shares. */
  declare(name: string, kind: i32, meta: string, description: string): void {
    if (!isFlagName(name)) {
      panic(
        `nish/cli-flags: a flag name is not empty and has no leading '-', '=' or whitespace, got "${name}"`
      )
    }
    if (this.indexOf(name) >= 0) {
      panic(`nish/cli-flags: --${name} is declared twice`)
    }
    // `--no-x` cannot be both a flag of its own and the clearing of a boolean `--x`.
    const clears = kind === FLAG_BOOLEAN ? this.indexOf(`no-${name}`) : toI32(-1)
    const cleared = name.startsWith("no-") ? this.indexOf(name.substring(3)) : toI32(-1)
    if (clears >= 0 || (cleared >= 0 && this.flags[cleared].kind === FLAG_BOOLEAN)) {
      panic(
        `nish/cli-flags: --${kind === FLAG_BOOLEAN ? `no-${name}` : name} would both be a flag and clear a boolean`
      )
    }
    this.flags.push(new FlagSpec(name, kind, meta, description))
  }

  /**
   * A command: `path` is one or more words (`"remote add"`), `shape` what
   * follows them in the help (`"<name> <url>"`, may be empty). Declaring any
   * command makes leading words that spell none a usage error.
   */
  command(path: string, shape: string, description: string): void {
    const words = splitWhitespace(path)
    const joined = words.join(" ")
    if (words.length === 0) {
      panic("nish/cli-flags: a command path has at least one word")
    }
    for (const w of words) {
      if (w.startsWith("-")) {
        panic(`nish/cli-flags: a command word has no leading '-', got "${w}" in "${joined}"`)
      }
    }
    for (const c of this.commands) {
      if (c.path === joined) {
        panic(`nish/cli-flags: the command "${joined}" is declared twice`)
      }
    }
    this.commands.push(new CommandSpec(joined, words, shape, description))
  }

  /** A string flag: `--name value` or `--name=value`, once. */
  string(name: string, meta: string, description: string): void {
    this.declare(name, FLAG_STRING, meta, description)
  }

  /**
   * A number flag, read as an `f64`: a finite decimal (`-2.5`, `1e3`, `.5`),
   * the same on every target. Hex, binary, `Infinity`, padding and `""` are
   * usage errors.
   */
  number(name: string, meta: string, description: string): void {
    this.declare(name, FLAG_NUMBER, meta, description)
  }

  /** A boolean flag: `--name` sets it, `--no-name` clears it, once. */
  boolean(name: string, description: string): void {
    this.declare(name, FLAG_BOOLEAN, "", description)
  }

  /** A flag given any number of times, each with a value. */
  repeatable(name: string, meta: string, description: string): void {
    this.declare(name, FLAG_REPEATABLE, meta, description)
  }

  /**
   * The index of the command `words` spell the longest declared path of, or
   * `-1`. A path spelled by a prefix of `words` counts; the words after it
   * are the positionals.
   */
  matchCommand(words: string[]): i32 {
    let best: i32 = -1
    let bestLength: i32 = 0
    for (let i: i32 = 0; i < toI32(this.commands.length); i++) {
      const path = this.commands[i].words
      const length = toI32(path.length)
      if (length <= toI32(words.length) && length > bestLength && agrees(path, words, length)) {
        best = i
        bestLength = length
      }
    }
    return best
  }

  /**
   * The words an unknown command is reported as: the leading words up to and
   * including the first that no declared path continues with, so
   * `remote rename x` against `remote add` is `"remote rename"`.
   */
  unknownCommand(words: string[]): string {
    let known: i32 = 0
    for (const c of this.commands) {
      let k: i32 = 0
      while (k < toI32(c.words.length) && k < toI32(words.length) && agrees(c.words, words, k + 1)) {
        k = k + 1
      }
      if (k > known) {
        known = k
      }
    }
    const shown: string[] = []
    for (let i: i32 = 0; i < toI32(words.length) && i <= known; i++) {
      shown.push(words[i])
    }
    return shown.join(" ")
  }

  /** `args` read against the table, every one of them an argument: `parseFrom(args, 0)`. */
  parse(args: string[]): ParsedFlags {
    return this.parseFrom(args, toI32(0))
  }

  /**
   * `args` from index `first` on read against the table, so that a program
   * passes `process.argv` and `1` to skip its own path. Stops at the first
   * usage error, which the answer then carries; the command is still matched
   * on the words read before it, so the usage hint can name it.
   */
  parseFrom(args: string[], first: i32): ParsedFlags {
    const got = new ParsedFlags(this)
    const words: string[] = []
    const trailing: string[] = []
    let ended = false
    // A value flag written without `=` waits here for the next argument,
    // which is its value whatever it looks like, so that `--jobs -1` and
    // `--grep --x` mean what they say.
    let pending: i32 = -1
    let pendingFlag = ""
    let pendingArg = ""
    for (let i: i32 = 0; i < toI32(args.length) && got.ok; i++) {
      const arg = args[i]
      if (i < first) {
        // Before `first`, so not read at all.
      } else if (pending >= 0) {
        got.take(pending, pendingFlag, arg, pendingArg)
        pending = -1
      } else if (ended) {
        trailing.push(arg)
      } else if (arg === "--") {
        ended = true
      } else if (arg === "-" || !arg.startsWith("-")) {
        words.push(arg)
      } else if (!arg.startsWith("--")) {
        got.fail(FLAG_ERR_UNKNOWN, `unknown flag ${arg}`, arg)
      } else {
        const eq = toI32(arg.indexOf("="))
        const flag = eq < 0 ? arg : arg.slice(0, eq)
        let at = this.indexOf(flag.substring(2))
        let negated = false
        if (at < 0 && flag.startsWith("--no-")) {
          const cleared = this.indexOf(flag.substring(5))
          if (cleared >= 0 && this.flags[cleared].kind === FLAG_BOOLEAN) {
            at = cleared
            negated = true
          }
        }
        if (at < 0) {
          got.fail(FLAG_ERR_UNKNOWN, `unknown flag ${flag}`, arg)
        } else {
          const spec = this.flags[at]
          if (spec.kind === FLAG_BOOLEAN) {
            if (eq >= 0) {
              got.fail(FLAG_ERR_BOOLEAN_VALUE, `${flag} takes no value`, arg)
            } else if (got.counts[at] > 0) {
              got.fail(FLAG_ERR_REPEATED, `--${spec.name} is given twice`, arg)
            } else {
              got.bools[at] = !negated
              got.counts[at] = 1
            }
          } else if (eq >= 0) {
            got.take(at, flag, arg.substring(eq + 1), arg)
          } else {
            pending = at
            pendingFlag = flag
            pendingArg = arg
          }
        }
      }
    }
    if (pending >= 0 && got.ok) {
      const meta = this.flags[pending].meta
      const wanted = meta.length > 0 ? meta : "a value"
      got.fail(FLAG_ERR_MISSING_VALUE, `${pendingFlag} needs ${wanted}`, pendingArg)
    }
    if (this.commands.length > 0) {
      const at = this.matchCommand(words)
      if (at >= 0) {
        got.commandAt = at
        got.command = this.commands[at].path
      } else if (words.length > 0 && got.ok) {
        const shown = this.unknownCommand(words)
        got.fail(FLAG_ERR_UNKNOWN_COMMAND, `unknown command "${shown}"`, shown)
      }
    }
    const skip: i32 = got.commandAt >= 0 ? toI32(this.commands[got.commandAt].words.length) : 0
    for (let w: i32 = 0; w < toI32(words.length); w++) {
      if (w >= skip) {
        got.positionals.push(words[w])
      }
    }
    for (const t of trailing) {
      got.positionals.push(t)
    }
    return got
  }

  /**
   * The table as help rows: a `Commands` section when any command is
   * declared (its path, shape and description), then a `Flags` section, each
   * in declaration order. The menu's header and usage lines are the caller's,
   * written before this.
   */
  writeHelp(menu: HelpMenu): void {
    if (this.commands.length > 0) {
      menu.section("Commands")
      for (const c of this.commands) {
        menu.row(c.path, c.shape, c.description)
      }
    }
    if (this.flags.length > 0) {
      menu.section("Flags")
      for (const f of this.flags) {
        menu.row(`--${f.name}`, f.meta, f.description)
      }
    }
  }
}

/**
 * What `parse` answered: a usage error, or every flag's value. Values sit in
 * arrays parallel to the table's `flags`: `counts` says how often each was
 * given, `texts` and `numbers` hold a string or number flag's value,
 * `bools` a boolean's and `lists` a repeatable flag's values in the order
 * given. A flag that was not given
 * reads as `""`, `0`, `false` or no values; `has` tells that apart from one
 * given as such.
 */
export class ParsedFlags {
  table: FlagTable
  ok: boolean
  code: i32
  message: string
  argument: string
  command: string
  commandAt: i32
  positionals: string[]
  counts: i32[]
  texts: string[]
  numbers: f64[]
  bools: boolean[]
  lists: string[][]

  constructor(table: FlagTable) {
    this.table = table
    this.ok = true
    this.code = FLAG_OK
    this.message = ""
    this.argument = ""
    this.command = ""
    this.commandAt = -1
    this.positionals = []
    this.counts = []
    this.texts = []
    this.numbers = []
    this.bools = []
    this.lists = []
    for (let i: i32 = 0; i < toI32(table.flags.length); i++) {
      this.counts.push(toI32(0))
      this.texts.push("")
      this.numbers.push(toF64(0))
      this.bools.push(false)
      const none: string[] = []
      this.lists.push(none)
    }
  }

  /** Records the first usage error; a parse stops at it. */
  fail(code: i32, message: string, argument: string): void {
    this.ok = false
    this.code = code
    this.message = message
    this.argument = argument
  }

  /** Stores `value` for the flag at `at`, spelled `flag` in `arg`, or fails as its kind requires. */
  take(at: i32, flag: string, value: string, arg: string): void {
    const kind = this.table.flags[at].kind
    if (kind === FLAG_REPEATABLE) {
      this.lists[at].push(value)
      this.counts[at] = this.counts[at] + 1
      return
    }
    if (this.counts[at] > 0) {
      this.fail(FLAG_ERR_REPEATED, `${flag} is given twice`, arg)
      return
    }
    if (kind === FLAG_NUMBER) {
      // `n - n` is zero exactly when `n` is finite: a decimal too large for
      // an f64 (`1e999`) reads as Infinity, which is not a count of anything.
      const decimal = isDecimal(value)
      const n: f64 = decimal ? Number(value) : toF64(0)
      if (!decimal || n - n !== 0) {
        this.fail(FLAG_ERR_NOT_A_NUMBER, `${flag} needs a number, not "${value}"`, value)
        return
      }
      this.numbers[at] = n
    }
    this.texts[at] = value
    this.counts[at] = 1
  }

  /** The index of the flag `name` of `kind`; a name the table does not declare so is a bug, and panics. */
  slot(name: string, kind: i32): i32 {
    const at = this.table.indexOf(name)
    if (at < 0 || this.table.flags[at].kind !== kind) {
      panic(`nish/cli-flags: ${this.table.program} declares no such flag --${name} of that kind`)
    }
    return at
  }

  /** A string flag's value, or `""` when it was not given. */
  str(name: string): string {
    return this.texts[this.slot(name, FLAG_STRING)]
  }

  /** A number flag's value, or `0` when it was not given. */
  num(name: string): f64 {
    return this.numbers[this.slot(name, FLAG_NUMBER)]
  }

  /** A boolean flag's value: true for `--name`, false for `--no-name` or when it was not given. */
  bool(name: string): boolean {
    return this.bools[this.slot(name, FLAG_BOOLEAN)]
  }

  /** Every value a repeatable flag was given, in order, as a fresh array; empty when it was not given. */
  all(name: string): string[] {
    const out: string[] = []
    for (const v of this.lists[this.slot(name, FLAG_REPEATABLE)]) {
      out.push(v)
    }
    return out
  }

  /** Whether the flag `name`, of any kind, was given at all (`--no-name` counts). */
  has(name: string): boolean {
    const at = this.table.indexOf(name)
    if (at < 0) {
      panic(`nish/cli-flags: ${this.table.program} declares no flag --${name}`)
    }
    return this.counts[at] > 0
  }

  /**
   * The usage line the error's hint shows: the matched command's path and
   * shape, or `<command>` when the table has commands and none matched, then
   * `[flags]`.
   */
  usageLine(): string {
    const table = this.table
    if (this.commandAt >= 0) {
      const c = table.commands[this.commandAt]
      const shape = c.shape.length > 0 ? ` ${c.shape}` : ""
      return `usage: ${table.program} ${c.path}${shape} [flags]`
    }
    if (table.commands.length > 0) {
      return `usage: ${table.program} <command> [flags]`
    }
    return `usage: ${table.program} [flags]`
  }

  /** What `exitUsage` prints: `<program>: <message>` and the usage line, each ending in a newline. */
  usageError(): string {
    return `${this.table.program}: ${this.message}\n${this.usageLine()}\n`
  }

  /** The usage error on stderr, then exit status 2. On a parse that succeeded it panics: there is no error to report. */
  exitUsage(): void {
    if (this.ok) {
      panic(`nish/cli-flags: ${this.table.program} calls exitUsage on a parse that succeeded`)
    }
    writeError(this.usageError())
    process.exit(2)
  }
}
