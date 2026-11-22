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
  /** @internal Used by `FlagTable`. */
  name: string
  /** @internal Used by `FlagTable` and `ParsedFlags`. */
  kind: i32
  /** @internal Used by `FlagTable`. */
  meta: string
  /** @internal Used by `FlagTable`. */
  description: string

  /**
   * A flag record as `FlagTable` stores it. A program declares flags through
   * the table's `string`, `number`, `boolean` and `repeatable` instead, which
   * check the name first; this constructor checks nothing.
   *
   * @param name what follows `--` on the command line, such as `"output"`
   * @param kind which `FLAG_*` kind the flag is, deciding whether it takes a
   *   value and which reader returns it
   * @param meta the placeholder the help row shows for its value, such as
   *   `"<file>"`; empty for a boolean
   * @param description the flag's line of help
   */
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
  /** @internal Used by `FlagTable` and `ParsedFlags`. */
  path: string
  /** @internal Used by `FlagTable`. */
  words: string[]
  /** @internal Used by `FlagTable` and `ParsedFlags`. */
  shape: string
  /** @internal Used by `FlagTable`. */
  description: string

  /**
   * A command record as `FlagTable` stores it. A program declares commands
   * through `FlagTable.command` instead, which splits and checks the path;
   * this constructor checks nothing.
   *
   * @param path the command's words joined by single spaces, such as
   *   `"remote add"`
   * @param words the same words one per element, kept as given, not copied
   * @param shape what the help row shows after the path, such as
   *   `"<name> <url>"`; may be empty
   * @param description the command's line of help
   */
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
  // Whether a digit came before the exponent, and one after the `e`: only
  // their presence matters, so no count that could grow.
  let mantissa = false
  let exponent = false
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    const c = toI32(text.charCodeAt(i))
    if (c >= 48 && c <= 57) {
      if (state >= 3) {
        exponent = true
        state = 4
      } else {
        mantissa = true
        state = state === 0 ? toI32(1) : state
      }
    } else if ((c === 43 || c === 45) && (state === 0 || state === 3)) {
      // A sign leads the number (0 to 1) or the exponent (3 to 4).
      state = state === 0 ? toI32(1) : toI32(4)
    } else if (c === 46 && state <= 1) {
      state = 2
    } else if ((c === 101 || c === 69) && (state === 1 || state === 2) && mantissa) {
      state = 3
    } else {
      return false
    }
  }
  return mantissa && (state < 3 || exponent)
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
  /** @internal Used by `ParsedFlags`. */
  program: string
  /** @internal Used by `ParsedFlags`. */
  flags: FlagSpec[]
  /** @internal Used by `ParsedFlags`. */
  commands: CommandSpec[]

  /**
   * An empty table: no flags and no commands until the declaring methods add
   * them.
   *
   * @param program the program's name as usage errors and their usage line
   *   show it, such as `"git-lite"`
   */
  constructor(program: string) {
    this.program = program
    this.flags = []
    this.commands = []
  }

  /** The flag `name` (without `--`) as declared, or `null` when the table declares none. */
  private find(name: string): FlagSpec | null {
    for (const f of this.flags) {
      if (f.name === name) {
        return f
      }
    }
    return null
  }

  /** A flag of `kind`, after the checks every declaring method shares. */
  private declare(name: string, kind: i32, meta: string, description: string): void {
    if (!isFlagName(name)) {
      panic(
        `nish/cli-flags: a flag name is not empty and has no leading '-', '=' or whitespace, got "${name}"`
      )
    }
    if (this.find(name) !== null) {
      panic(`nish/cli-flags: --${name} is declared twice`)
    }
    // `--no-x` cannot be both a flag of its own and the clearing of a boolean `--x`.
    const clears = kind === FLAG_BOOLEAN && this.find(`no-${name}`) !== null
    const base: FlagSpec | null = name.startsWith("no-") ? this.find(name.substring(3)) : null
    const cleared = base !== null && base.kind === FLAG_BOOLEAN
    if (clears || cleared) {
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
   *
   * @param path the words a person types to choose the command, separated by
   *   whitespace; runs of whitespace collapse to one space. Panics when it has
   *   no word, a word starts with `-`, or the path is already declared
   * @param shape what the help and the usage hint show after the path, such
   *   as `"<name> <url>"`; empty for none
   * @param description the command's line in the `Commands` help section
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

  /**
   * A string flag: `--name value` or `--name=value`, once.
   *
   * @param name what follows `--`, such as `"output"`; panics on a name no
   *   command line could match, one already declared, or a `no-x` beside a
   *   declared boolean `x`
   * @param meta the placeholder the help row and the missing-value message
   *   show, such as `"<file>"`; when empty the message says "a value"
   * @param description the flag's line in the `Flags` help section
   */
  string(name: string, meta: string, description: string): void {
    this.declare(name, FLAG_STRING, meta, description)
  }

  /**
   * A number flag, read as an `f64`: a finite decimal (`-2.5`, `1e3`, `.5`),
   * the same on every target. Hex, binary, `Infinity`, padding and `""` are
   * usage errors.
   *
   * @param name what follows `--`, such as `"jobs"`; panics on a name no
   *   command line could match, one already declared, or a `no-x` beside a
   *   declared boolean `x`
   * @param meta the placeholder the help row and the missing-value message
   *   show, such as `"<n>"`; when empty the message says "a value"
   * @param description the flag's line in the `Flags` help section
   */
  number(name: string, meta: string, description: string): void {
    this.declare(name, FLAG_NUMBER, meta, description)
  }

  /**
   * A boolean flag: `--name` sets it, `--no-name` clears it, once.
   *
   * @param name what follows `--`, such as `"verbose"`; panics on a name no
   *   command line could match, one already declared, one whose `no-`
   *   form is itself a declared flag, or a `no-x` beside a declared boolean
   *   `x`
   * @param description the flag's line in the `Flags` help section
   */
  boolean(name: string, description: string): void {
    this.declare(name, FLAG_BOOLEAN, "", description)
  }

  /**
   * A flag given any number of times, each with a value.
   *
   * @param name what follows `--`, such as `"include"`; panics on a name no
   *   command line could match, one already declared, or a `no-x` beside a
   *   declared boolean `x`
   * @param meta the placeholder the help row and the missing-value message
   *   show, such as `"<dir>"`; when empty the message says "a value"
   * @param description the flag's line in the `Flags` help section
   */
  repeatable(name: string, meta: string, description: string): void {
    this.declare(name, FLAG_REPEATABLE, meta, description)
  }

  /**
   * The command `words` spell the longest declared path of, or `null`. A
   * path spelled by a prefix of `words` counts; the words after it are the
   * positionals.
   */
  private matchCommand(words: string[]): CommandSpec | null {
    let best: CommandSpec | null = null
    let bestLength: i32 = 0
    for (const c of this.commands) {
      const length = toI32(c.words.length)
      if (length <= toI32(words.length) && length > bestLength && agrees(c.words, words, length)) {
        best = c
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
  private unknownCommand(words: string[]): string {
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

  /**
   * `args` read against the table, every one of them an argument:
   * `parseFrom(args, 0)`.
   *
   * @param args the command line's words, without the program's own path
   * @returns a fresh answer the caller owns: the usage error, or every
   *   flag's value, the command and the positionals
   */
  parse(args: string[]): ParsedFlags {
    return this.parseFrom(args, toI32(0))
  }

  /**
   * `args` from index `first` on read against the table, so that a program
   * passes `process.argv` and `1` to skip its own path. Stops at the first
   * usage error, which the answer then carries; the command is still matched
   * on the words read before it, so the usage hint can name it.
   *
   * @param args the command line's words, such as `process.argv`
   * @param first how many leading elements of `args` to skip unread; `0`
   *   reads them all, and one at or past the end reads none
   * @returns a fresh answer the caller owns: the usage error, or every
   *   flag's value, the command and the positionals
   */
  parseFrom(args: string[], first: i32): ParsedFlags {
    const got = new ParsedFlags(this)
    const words: string[] = []
    const trailing: string[] = []
    let ended = false
    // A value flag written without `=` waits here for the next argument,
    // which is its value whatever it looks like, so that `--jobs -1` and
    // `--grep --x` mean what they say.
    let pending: FlagValue | null = null
    let pendingFlag = ""
    let pendingArg = ""
    for (let i: i32 = 0; i < toI32(args.length) && got.ok; i++) {
      const arg = args[i]
      if (i < first) {
        // Before `first`, so not read at all.
      } else if (pending !== null) {
        got.take(pending, pendingFlag, arg, pendingArg)
        pending = null
      } else if (ended) {
        trailing.push(arg)
      } else if (arg === "--") {
        ended = true
      } else if (arg === "-" || !arg.startsWith("-")) {
        words.push(arg)
      } else if (!arg.startsWith("--")) {
        got.fail(FLAG_ERR_UNKNOWN, `unknown flag ${arg}`, arg)
      } else {
        // `--name=value` splits at its first `=`; the `--` holds none.
        let flag = arg
        let value = ""
        let joined = false
        for (let k: i32 = 2; k < toI32(arg.length); k++) {
          if (arg.charCodeAt(k) === 61) {
            flag = arg.substring(0, k)
            value = arg.substring(k + 1)
            joined = true
            break
          }
        }
        const found = got.lookup(flag)
        if (found === null) {
          got.fail(FLAG_ERR_UNKNOWN, `unknown flag ${flag}`, arg)
        } else if (found.spec.kind === FLAG_BOOLEAN) {
          if (joined) {
            got.fail(FLAG_ERR_BOOLEAN_VALUE, `${flag} takes no value`, arg)
          } else if (found.given) {
            got.fail(FLAG_ERR_REPEATED, `--${found.spec.name} is given twice`, arg)
          } else {
            // `lookup` matched the base name of a `--no-x` exactly when the
            // name it found is not the one written.
            found.bool = found.spec.name === flag.substring(2)
            found.given = true
          }
        } else if (joined) {
          got.take(found, flag, value, arg)
        } else {
          pending = found
          pendingFlag = flag
          pendingArg = arg
        }
      }
    }
    if (pending !== null && got.ok) {
      const meta = pending.spec.meta
      const wanted = meta.length > 0 ? meta : "a value"
      got.fail(FLAG_ERR_MISSING_VALUE, `${pendingFlag} needs ${wanted}`, pendingArg)
    }
    let skip: i32 = 0
    if (this.commands.length > 0) {
      const chosen = this.matchCommand(words)
      if (chosen !== null) {
        got.chosen = chosen
        got.command = chosen.path
        skip = toI32(chosen.words.length)
      } else if (words.length > 0 && got.ok) {
        const shown = this.unknownCommand(words)
        got.fail(FLAG_ERR_UNKNOWN_COMMAND, `unknown command "${shown}"`, shown)
      }
    }
    for (let w: i32 = 0; w < toI32(words.length); w++) {
      if (w >= skip) {
        got.positionals.push(words[w])
      }
    }
    for (const t of trailing) {
      got.positionals.push(t)
    }
    got.publish()
    return got
  }

  /**
   * The table as help rows: a `Commands` section when any command is
   * declared (its path, shape and description), then a `Flags` section, each
   * in declaration order. The menu's header and usage lines are the caller's,
   * written before this.
   *
   * @param menu the help being written, which gains the rows; nothing is
   *   written for an empty table
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
 * One flag's answer, beside the declaration it answers for, so that one
 * lookup by name reaches the kind and every value without an index.
 */
class FlagValue {
  /** The declaration, shared with the table. */
  spec: FlagSpec
  /** A string or number flag's value as written, `""` when not given. */
  text: string
  /** A number flag's value, `0` when not given. */
  number: f64
  /** A repeatable flag's values in the order given; empty when not given. */
  list: string[]
  /** Whether the command line gave the flag; for a boolean, in either spelling. */
  given: boolean
  /** A boolean flag's value, `false` when not given. */
  bool: boolean

  constructor(spec: FlagSpec) {
    this.spec = spec
    this.text = ""
    this.number = toF64(0)
    this.list = []
    this.given = false
    this.bool = false
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
  private table: FlagTable
  /** Whether the parse found no usage error; `false` means `code` names one. */
  ok: boolean
  /** `FLAG_OK`, or the `FLAG_ERR_*` kind of the first usage error. */
  code: i32
  /** The usage error in words, such as `unknown flag --x`; `""` when `ok`. */
  message: string
  /**
   * The argument the error was found in, as given (`--x=1` whole), or for a
   * number flag the bad value alone and for an unknown command the words
   * shown in the message; `""` when `ok`.
   */
  argument: string
  /** The path of the command the leading words chose, or `""` for none. */
  command: string
  /** @internal Used by `FlagTable`. The command the leading words chose, or `null`. */
  chosen: CommandSpec | null
  /**
   * The words that are not flags, values or the command's path, in order,
   * then every argument after `--`. On a usage error, only those among the
   * arguments read before the parse stopped.
   */
  positionals: string[]
  /** How many times each flag was given, indexed like the table's `flags`. */
  counts: i32[]
  /** Each string or number flag's value as written, `""` when not given. */
  texts: string[]
  /** Each number flag's value, `0` when not given. */
  numbers: f64[]
  /** Each boolean flag's value, `false` when not given. */
  bools: boolean[]
  /** Each repeatable flag's values in the order given; empty when not given. */
  lists: string[][]
  /**
   * One answer per flag the table declared when the parse began, in its
   * order: what the readers look up, and what `publish` copies into the
   * arrays above.
   */
  private values: FlagValue[]

  /**
   * An answer with no error and every flag unset, which `FlagTable.parseFrom`
   * then fills in. A program gets one from `parse` rather than building it.
   *
   * @param table the table whose flags this answer holds a value for each
   *   of; it is kept, not copied, and should not gain flags afterwards
   */
  constructor(table: FlagTable) {
    this.table = table
    this.ok = true
    this.code = FLAG_OK
    this.message = ""
    this.argument = ""
    this.command = ""
    this.chosen = null
    this.positionals = []
    this.counts = []
    this.texts = []
    this.numbers = []
    this.bools = []
    this.lists = []
    this.values = []
    for (const f of table.flags) {
      this.values.push(new FlagValue(f))
    }
    this.publish()
  }

  /**
   * @internal Called by `FlagTable`. Rewrites `counts`, `texts`, `numbers`,
   * `bools` and `lists` from the answers, one element per flag in the
   * table's order; a repeatable flag's count is how many values it holds.
   */
  publish(): void {
    this.counts = []
    this.texts = []
    this.numbers = []
    this.bools = []
    this.lists = []
    for (const v of this.values) {
      const once: i32 = v.given ? 1 : 0
      this.counts.push(v.spec.kind === FLAG_REPEATABLE ? toI32(v.list.length) : once)
      this.texts.push(v.text)
      this.numbers.push(v.number)
      this.bools.push(v.bool)
      this.lists.push(v.list)
    }
  }

  /**
   * @internal Called by `FlagTable`. The answer for `flag` as written
   * (`--name`, without any `=value`): the flag of that name, or for
   * `--no-x` the boolean `x`, or `null` for neither. One pass: the table
   * never holds both a `no-x` and a boolean `x`, so at most one answer
   * matches.
   */
  lookup(flag: string): FlagValue | null {
    const name = flag.substring(2)
    const base = flag.startsWith("--no-") ? flag.substring(5) : ""
    for (const v of this.values) {
      if (v.spec.name === name || (base.length > 0 && v.spec.kind === FLAG_BOOLEAN && v.spec.name === base)) {
        return v
      }
    }
    return null
  }

  /** @internal Called by `FlagTable`. Records the first usage error; a parse stops at it. */
  fail(code: i32, message: string, argument: string): void {
    this.ok = false
    this.code = code
    this.message = message
    this.argument = argument
  }

  /** @internal Called by `FlagTable`. Stores `value` for the flag `into`, spelled `flag` in `arg`, or fails as its kind requires. */
  take(into: FlagValue, flag: string, value: string, arg: string): void {
    const kind = into.spec.kind
    if (kind === FLAG_REPEATABLE) {
      into.list.push(value)
      into.given = true
      return
    }
    if (into.given) {
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
      into.number = n
    }
    into.text = value
    into.given = true
  }

  /**
   * The answer for the flag `name` of `kind`; a name the table does not
   * declare so, or declared after this parse, is a bug, and panics.
   */
  private slot(name: string, kind: i32): FlagValue {
    for (const v of this.values) {
      if (v.spec.name === name && v.spec.kind === kind) {
        return v
      }
    }
    panic(`nish/cli-flags: ${this.table.program} declares no such flag --${name} of that kind`)
  }

  /**
   * A string flag's value, or `""` when it was not given.
   *
   * @param name the flag as declared, without `--`; panics when the table
   *   declares no string flag of that name
   * @returns the value as it appeared on the command line
   */
  str(name: string): string {
    return this.slot(name, FLAG_STRING).text
  }

  /**
   * A number flag's value, or `0` when it was not given.
   *
   * @param name the flag as declared, without `--`; panics when the table
   *   declares no number flag of that name
   * @returns the finite value the command line gave
   */
  num(name: string): f64 {
    return this.slot(name, FLAG_NUMBER).number
  }

  /**
   * A boolean flag's value: true for `--name`, false for `--no-name` or when
   * it was not given.
   *
   * @param name the flag as declared, without `--` or `no-`; panics when the
   *   table declares no boolean flag of that name
   * @returns whether the flag is set
   */
  bool(name: string): boolean {
    return this.slot(name, FLAG_BOOLEAN).bool
  }

  /**
   * Every value a repeatable flag was given, in order; empty when it was not
   * given.
   *
   * @param name the flag as declared, without `--`; panics when the table
   *   declares no repeatable flag of that name
   * @returns a fresh array the caller owns; changing it leaves the answer as
   *   it was
   */
  all(name: string): string[] {
    const out: string[] = []
    for (const v of this.slot(name, FLAG_REPEATABLE).list) {
      out.push(v)
    }
    return out
  }

  /**
   * Whether the flag `name`, of any kind, was given at all (`--no-name`
   * counts).
   *
   * @param name the flag as declared, without `--`; panics when the table
   *   declares no flag of that name
   * @returns `true` when the command line gave it at least once
   */
  has(name: string): boolean {
    // A flag declared after this parse has no answer in it.
    for (const v of this.values) {
      if (v.spec.name === name) {
        return v.given
      }
    }
    panic(`nish/cli-flags: ${this.table.program} declares no flag --${name}`)
  }

  /**
   * The usage line the error's hint shows: the matched command's path and
   * shape, or `<command>` when the table has commands and none matched, then
   * `[flags]`.
   */
  private usageLine(): string {
    const table = this.table
    const c = this.chosen
    if (c !== null) {
      const shape = c.shape.length > 0 ? ` ${c.shape}` : ""
      return `usage: ${table.program} ${c.path}${shape} [flags]`
    }
    if (table.commands.length > 0) {
      return `usage: ${table.program} <command> [flags]`
    }
    return `usage: ${table.program} [flags]`
  }

  /**
   * What `exitUsage` prints: `<program>: <message>` and the usage line, each
   * ending in a newline.
   *
   * @returns a fresh string; on a parse that succeeded its message part is
   *   empty
   */
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
