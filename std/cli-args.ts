/**
 * `std/cli-args` — a command tree for a large command-line tool: declared
 * once with a builder, parsed in one walk over the arguments, and answered as
 * the matched command's id and every value with where it came from.
 *
 *     import { Cli, ROOT, finish } from "nish/cli-args";
 *     import { Style } from "nish/cli";
 *
 *     const cli = new Cli("api", "1.4.0", "Talk to the Example API");
 *     const raw = cli.globalFlag("-r, --raw-output", "print JSON as it arrives");
 *     const users = cli.group(ROOT, "users", "Manage users");
 *     const list = cli.command(users, "list", 1, "List users");
 *     const limit = cli.flag(list, "-l, --limit <n>", "at most n users");
 *     const r = cli.parse(process.argv, 1);
 *     finish(r, new Style(false, false), new Style(false, false));
 *     if (r.id === 1) console.log(r.value(limit) ?? "all");
 *
 * **A builder, not a table.** Nish has no function values, so a command
 * cannot carry its handler; what a builder gives instead is a handle for
 * every command, flag and argument, so the program reads a value by the
 * handle it declared rather than by a name a typo can miss, and every
 * declaration mistake panics at the call that made it. Each declaration has
 * a `try` twin (`tryCommand`, `tryFlag`, ...) that answers the same mistake
 * as an `Err` instead, and the twins that declare a flag or an argument
 * answer a `CliFlag` or `CliArgument` that `ParseResult`'s `read` methods
 * take, so a program that uses them reaches no panic.
 *
 * **What it costs.** Declaring is linear in the declarations and builds no
 * help text. Parsing walks the arguments once, with one map lookup per
 * token, and keeps only what the arguments set; help text, did-you-mean and
 * the error wording are built only on the help and error paths.
 *
 * **What it reaches.** Nothing: `parse` reads only the array it is given,
 * and only `finish` writes (to standard output or standard error) and exits.
 */

import { HelpMenu, Style } from "nish/cli"

/** The handle of the tree's root, the program itself. */
export const ROOT: i32 = 0

/** `ParseResult.kind`: the arguments name a command to run. */
export const PARSE_OK: i32 = 0

/** `ParseResult.kind`: `-h`, `--help` or `help <path>` asked for help. */
export const PARSE_HELP: i32 = 1

/** `ParseResult.kind`: `-v` or `--version` at the root asked for the version. */
export const PARSE_VERSION: i32 = 2

/** `ParseResult.kind`: the arguments are wrong; `message` says how. */
export const PARSE_ERROR: i32 = 3

/** `ParseResult.source`: the value was given on the command line. */
export const SOURCE_ARGV: i32 = 0

/** `ParseResult.source`: the value is the declared default. */
export const SOURCE_DEFAULT: i32 = 1

/** `ParseResult.source`: the flag was not given and has no default. */
export const SOURCE_UNSET: i32 = 2

/** A flag that takes no value. */
const VALUE_NONE: i32 = 0

/** A flag whose value is required: `--name <value>`. */
const VALUE_REQUIRED: i32 = 1

/** A flag whose value is optional: `--name [value]`. */
const VALUE_OPTIONAL: i32 = 2

/** The owner of a global flag, which no command handle is. */
const GLOBAL: i32 = -1

/** The parent of the root, which no command handle is. */
const NO_PARENT: i32 = -1

/** The id a group answers in `ParseResult.id`, which no command's is. */
const GROUP_ID: i32 = -1

/** Where descriptions start at the latest, in a help row. */
const MAX_COLUMN: i32 = 32

/** The ASCII hyphen-minus every flag opens with. */
const DASH: i32 = 45

/** The key a child, alias or flag is found by within its scope. */
const scopeKey = (scope: i32, name: string): string => `${scope}\u0000${name}`

/** Whether `name` is a word a command line can name: not empty, no space, no `=`, no leading dash. */
const isWord = (name: string): boolean =>
  name.length > 0 && name.indexOf(" ") < 0 && name.indexOf("=") < 0 && toI32(name.charCodeAt(0)) !== DASH

/** The smaller of two widened edit costs. */
const minI64 = (a: i64, b: i64): i64 => (a < b ? a : b)

/**
 * One column of the edit-distance table: the byte of `b` it stands for, and
 * its cells in the row two above, the row above and the row being worked.
 */
class Cell {
  /** @internal Used by `editDistance`. */
  ch: i32
  /** @internal Used by `editDistance`. */
  two: i32
  /** @internal Used by `editDistance`. */
  up: i32
  /** @internal Used by `editDistance`. */
  cur: i32

  constructor(ch: i32, up: i32) {
    this.ch = ch
    this.two = 0
    this.up = up
    this.cur = 0
  }
}

/**
 * The edit distance between `a` and `b` in bytes, a swap of two neighbours
 * counting as one edit (`kyes` is one from `keys`). The table is kept as one
 * `Cell` per byte of `b`, each holding its own column of the last three rows,
 * so every cell is read through the one array the loops are bounded by.
 * `cols` is the caller's, reused across calls: it is cut or grown here to
 * one cell per byte of `b`.
 */
const editDistance = (a: string, b: string, cols: Cell[]): i32 => {
  // Row 0: `b`'s first `j + 1` bytes are `j + 1` inserts from nothing.
  for (let j: i32 = 0; j < toI32(b.length); j++) {
    const ch: i32 = toI32(b.charCodeAt(j))
    if (j < toI32(cols.length)) {
      const cell = cols[j]
      cell.ch = ch
      cell.up = j + 1
    } else {
      cols.push(new Cell(ch, j + 1))
    }
  }
  while (toI32(cols.length) > toI32(b.length) && cols.length > 0) {
    cols.pop()
  }
  for (let k: i32 = 0; k < toI32(a.length); k++) {
    const ch: i32 = toI32(a.charCodeAt(k))
    // The byte before `a`'s, for a swap; -1, which no byte is, on the first row.
    const before: i32 = k > 0 ? toI32(a.charCodeAt(k - 1)) : -1
    for (let j: i32 = 0; j < toI32(cols.length); j++) {
      const cell = cols[j]
      // Column 0 of the table, left of every cell, is `k + 1` deletes in this
      // row and `k` in the row above; `k - 1` two rows up.
      let left: i32 = k + 1
      let diag: i32 = k
      let leftCh: i32 = -1
      let swap: i32 = k - 1
      if (j > 0) {
        const prev = cols[j - 1]
        left = prev.cur
        diag = prev.up
        leftCh = prev.ch
      }
      if (j > 1) {
        swap = cols[j - 2].two
      }
      // Widened: a cell holds at most the longer string's length, so the sum
      // fits an i64 and narrowing it back to i32 keeps it whole.
      const change: i64 = cell.ch === ch ? toI64(diag) : toI64(diag) + toI64(1)
      let d: i64 = minI64(minI64(toI64(cell.up) + toI64(1), toI64(left) + toI64(1)), change)
      if (k > 0 && j > 0 && cell.ch === before && leftCh === ch) {
        d = minI64(d, toI64(swap) + toI64(1))
      }
      cell.cur = toI32(d)
    }
    for (let j: i32 = 0; j < toI32(cols.length); j++) {
      const cell = cols[j]
      cell.two = cell.up
      cell.up = cell.cur
    }
  }
  // The last column's newest row; with `b` empty, deleting all of `a`.
  let distance: i32 = toI32(a.length)
  for (let j: i32 = 0; j < toI32(cols.length); j++) {
    distance = cols[j].up
  }
  return distance
}

/**
 * The candidate in `names` closest to `typed`, or empty when none is within
 * `max(2, w / 3)` edits for a `typed` of `w` bytes past its dashes; the first
 * declared wins a tie.
 */
const closest = (typed: string, names: string[]): string => {
  let dashes: i32 = 0
  while (dashes < toI32(typed.length) && toI32(typed.charCodeAt(dashes)) === DASH) {
    dashes = dashes + 1
  }
  const third: i32 = (toI32(typed.length) - dashes) / 3
  let best: i32 = third > 2 ? third : 2
  let near = ""
  const cols: Cell[] = []
  for (let i: i32 = 0; i < toI32(names.length); i++) {
    const name = names[i]
    const d = editDistance(typed, name, cols)
    if (d <= best && (near.length === 0 || d < best)) {
      best = d
      near = name
    }
  }
  return near
}

/** A flag spec taken apart: `-r, --raw-output`, `--limit <n>`, `--no-color`. */
class FlagSpec {
  /** @internal Used by `Cli`. */
  short: string
  /** @internal Used by `Cli`. */
  long: string
  /** @internal Used by `Cli`. */
  meta: string
  /** @internal Used by `Cli`. */
  value: i32
  /** @internal Used by `Cli`. */
  negated: boolean

  constructor(short: string, long: string, meta: string, value: i32, negated: boolean) {
    this.short = short
    this.long = long
    this.meta = meta
    this.value = value
    this.negated = negated
  }
}

/** `spec` taken apart, or why it is not a flag spec; `call` names the declaration in the error. */
const parseFlagSpec = (call: string, spec: string): Result<FlagSpec, string> => {
  let rest = spec
  let short = ""
  if (rest.startsWith("-") && !rest.startsWith("--")) {
    if (!(rest.length >= 6 && rest.substring(2, 4) === ", ")) {
      return Err(`cli-args: ${call}: bad flag spec '${spec}': a short flag is one letter, then ', --name'`)
    }
    short = rest.substring(1, 2)
    if (!isWord(short)) {
      return Err(`cli-args: ${call}: bad flag spec '${spec}': the short flag is not a letter`)
    }
    rest = rest.substring(4)
  }
  if (!rest.startsWith("--")) {
    return Err(`cli-args: ${call}: bad flag spec '${spec}': a flag is written '--name'`)
  }
  const space: i32 = toI32(rest.indexOf(" "))
  let long = space < 0 ? rest.substring(2) : rest.substring(2, space)
  // From the space on, less the space itself: no index arithmetic.
  const meta = space < 0 ? "" : rest.substring(space).substring(1)
  if (!isWord(long)) {
    return Err(
      `cli-args: ${call}: bad flag spec '${spec}': the name is empty or has a space, '=' or leading dash`
    )
  }
  let value = VALUE_NONE
  if (meta.length > 0) {
    const inner = meta.substring(1, meta.length - 1)
    if (meta.startsWith("<") && meta.endsWith(">") && isWord(inner)) {
      value = VALUE_REQUIRED
    } else if (meta.startsWith("[") && meta.endsWith("]") && isWord(inner)) {
      value = VALUE_OPTIONAL
    } else {
      return Err(`cli-args: ${call}: bad flag spec '${spec}': a value is written <value> or [value]`)
    }
  }
  const negated = value === VALUE_NONE && long.startsWith("no-") && long.length > 3
  if (negated) {
    long = long.substring(3)
  }
  return Ok(new FlagSpec(short, long, meta, value, negated))
}

/** A command or group as declared: everything the walk and the help read of it. */
class CommandRec {
  /** @internal Used by `Cli`. */
  name: string
  /** @internal Used by `Cli`. The parent's path; empty for the root. */
  parentPath: string
  /** @internal Used by `Cli`. */
  description: string
  /** @internal Used by `Cli` and `ParseResult`. */
  path: string
  /** @internal Used by `Cli`. Its aliases, joined by `, ` for its help row. */
  aliases: string
  /** @internal Used by `Cli`. */
  epilog: string
  /** @internal Used by `Cli` and `ParseResult`. Its arguments in order, each at its own index. */
  args: CliArgument[]
  /** @internal Used by `Cli` and `ParseResult`. */
  handle: i32
  /** @internal Used by `Cli`. The parent's handle; -1 for the root. */
  parent: i32
  /** @internal Used by `ParseResult`. */
  id: i32
  /** @internal Used by `Cli` and `ParseResult`. */
  group: boolean
  /** @internal Used by `Cli`. Whether its last argument is variadic. */
  variadic: boolean
  /** @internal Used by `Cli`. Whether its last argument is optional. */
  optionalArg: boolean
  /** @internal Used by `Cli`. Whether one of its own flags is required. */
  hasRequired: boolean

  constructor(
    handle: i32,
    name: string,
    parent: i32,
    parentPath: string,
    id: i32,
    description: string,
    group: boolean,
    path: string
  ) {
    this.handle = handle
    this.name = name
    this.parent = parent
    this.parentPath = parentPath
    this.id = id
    this.description = description
    this.group = group
    this.path = path
    this.aliases = ""
    this.epilog = ""
    this.args = []
    this.variadic = false
    this.optionalArg = false
    this.hasRequired = false
  }
}

/** An alias, kept in declaration order for the did-you-mean candidates. */
class AliasRec {
  /** @internal Used by `Cli`. */
  name: string
  /** @internal Used by `Cli`. The handle of the group it is a name in. */
  parent: i32

  constructor(name: string, parent: i32) {
    this.name = name
    this.parent = parent
  }
}

/**
 * A flag as declared, answered by `Cli.tryFlag` and `Cli.tryGlobalFlag`:
 * `ParseResult`'s `read` methods take it, and need no handle check to.
 */
export class CliFlag {
  /** The flag's handle, for the methods that take one, such as `Cli.tryDefaultValue`. */
  handle: i32
  /** @internal Used by `Cli` and `ParseResult`. The owning command's handle, or -1 for a global flag. */
  owner: i32
  /** @internal Used by `Cli`. The owning command; the root for a global flag. */
  scope: CommandRec
  /** @internal Used by `Cli`. */
  short: string
  /** @internal Used by `Cli` and `ParseResult`. */
  long: string
  /** @internal Used by `Cli`. */
  meta: string
  /** @internal Used by `Cli` and `ParseResult`. */
  value: i32
  /** @internal Used by `Cli` and `ParseResult`. */
  negated: boolean
  /** @internal Used by `Cli`. */
  negatable: boolean
  /** @internal Used by `Cli`. */
  description: string
  /** @internal Used by `Cli` and `ParseResult`. */
  fallback: string
  /** @internal Used by `Cli` and `ParseResult`. */
  hasDefault: boolean
  /** @internal Used by `Cli`. */
  required: boolean
  /** @internal Used by `Cli` and `ParseResult`. */
  repeatable: boolean

  /** @internal Called by `Cli`. */
  constructor(handle: i32, owner: i32, scope: CommandRec, spec: FlagSpec, description: string) {
    this.handle = handle
    this.owner = owner
    this.scope = scope
    this.short = spec.short
    this.long = spec.long
    this.meta = spec.meta
    this.value = spec.value
    this.negated = spec.negated
    this.negatable = spec.negated
    this.description = description
    this.fallback = ""
    this.hasDefault = false
    this.required = false
    this.repeatable = false
  }

  /** @internal Called by `Cli` and `ParseResult`. How it is spelled on the command line: its long name, or `--no-x` for one declared that way. */
  spelling(): string {
    return this.negated ? `--no-${this.long}` : `--${this.long}`
  }

  /** @internal Called by `Cli`. Whether it answers to `--name`, as itself or, negatable, as its negation. */
  answersTo(name: string): boolean {
    return this.long === name || (this.negatable && `no-${this.long}` === name)
  }
}

/**
 * A positional argument as declared, answered by `Cli.tryArgument`:
 * `ParseResult.readPositional` and `readPositionals` take it.
 */
export class CliArgument {
  /** @internal Used by `Cli` and `ParseResult`. */
  name: string
  /** @internal Used by `Cli`. */
  description: string
  /** The argument's handle, for `ParseResult.positional` and `positionals`. */
  handle: i32
  /** @internal Used by `ParseResult`. The owning command's handle. */
  owner: i32
  /** @internal Used by `ParseResult`. Its place among its command's positionals. */
  index: i32
  /** @internal Used by `Cli` and `ParseResult`. */
  required: boolean
  /** @internal Used by `Cli` and `ParseResult`. */
  variadic: boolean

  /** @internal Called by `Cli`. */
  constructor(
    handle: i32,
    owner: i32,
    name: string,
    required: boolean,
    variadic: boolean,
    description: string,
    index: i32
  ) {
    this.handle = handle
    this.owner = owner
    this.name = name
    this.required = required
    this.variadic = variadic
    this.description = description
    this.index = index
  }
}

/**
 * A command tree: groups, which only hold commands, and leaf commands, which
 * a program runs, each with its flags and positional arguments. Every
 * declaration answers a handle (an `i32`) that `parse`'s answer is read by.
 */
export class Cli {
  /** @internal Used by `ParseResult`. */
  name: string
  /** @internal Used by `ParseResult`. */
  version: string
  private description: string

  // One record per declaration, at its handle's index: a handle is checked
  // once, by `commandAt`, `flagAt` or `argumentAt`, and the record it finds
  // carries every field, so nothing after that is read by an index.
  /** @internal Used by `ParseResult`. */
  root: CommandRec
  private cmds: CommandRec[]
  private aliasList: AliasRec[]
  private children: Map<string, CommandRec>
  private ids: Map<string, CommandRec>
  private flagList: CliFlag[]
  private flags: Map<string, CliFlag>
  private negations: Map<string, CliFlag>
  /** @internal Used by `ParseResult`. Every required flag, in the order `required` made it so. */
  requiredFlags: CliFlag[]
  private argList: CliArgument[]

  /**
   * A tree with only its root, the program `name` at `version`, for
   * `description`.
   *
   * @param name the program's name, which starts every command path, usage
   *   line and error line, such as `"api"`
   * @param version what `--version` prints after the name, such as `"1.4.0"`
   * @param description the one-line summary every help page's header shows
   *   after the version
   */
  constructor(name: string, version: string, description: string) {
    this.name = name
    this.version = version
    this.description = description
    this.root = new CommandRec(ROOT, name, NO_PARENT, "", GROUP_ID, description, false, name)
    this.cmds = [this.root]
    this.aliasList = []
    this.children = new Map<string, CommandRec>()
    this.ids = new Map<string, CommandRec>()
    this.flagList = []
    this.flags = new Map<string, CliFlag>()
    this.negations = new Map<string, CliFlag>()
    this.requiredFlags = []
    this.argList = []
  }

  /** The command `handle`, or why it is none; `call` names the declaration in the error. */
  private commandAt(call: string, handle: i32): Result<CommandRec, string> {
    if (handle >= 0 && handle < toI32(this.cmds.length)) {
      return Ok(this.cmds[handle])
    }
    return Err(`cli-args: ${call}: ${handle} is not a command handle`)
  }

  /** The flag `handle`, or why it is none; `call` names the declaration in the error. */
  private flagAt(call: string, handle: i32): Result<CliFlag, string> {
    if (handle >= 0 && handle < toI32(this.flagList.length)) {
      return Ok(this.flagList[handle])
    }
    return Err(`cli-args: ${call}: ${handle} is not a flag handle`)
  }

  /** @internal Called by `ParseResult`. The flag `handle`, or a panic naming `call` when there is none. */
  checkFlag(call: string, handle: i32): CliFlag {
    const f = this.flagAt(call, handle)
    if (f.isErr()) {
      // A handle no declaration answered: the program's own mistake.
      panic(f.error)
    }
    return f.value
  }

  /** @internal Called by `ParseResult`. The argument `handle`, or a panic naming `call` when there is none. */
  checkArgument(call: string, handle: i32): CliArgument {
    if (!(handle >= 0 && handle < toI32(this.argList.length))) {
      // A handle no declaration answered: the program's own mistake.
      panic(`cli-args: ${call}: ${handle} is not an argument handle`)
    }
    return this.argList[handle]
  }

  /** A new child of `parent`, or why it cannot be; `call` names the declaration in the error. */
  private addCommand(
    call: string,
    parent: i32,
    name: string,
    id: i32,
    description: string,
    group: boolean
  ): Result<CommandRec, string> {
    const at = this.commandAt(call, parent)
    if (at.isErr()) {
      return Err(at.error)
    }
    const p = at.value
    if (!isWord(name)) {
      return Err(`cli-args: ${call}: '${name}' is not a command name`)
    }
    if (p.handle !== ROOT && !p.group) {
      return Err(`cli-args: ${call}: ${p.path} is a command, not a group`)
    }
    if (p.args.length > 0) {
      return Err(`cli-args: ${call}: ${p.path} takes arguments, so it cannot hold commands`)
    }
    if (p.hasRequired) {
      return Err(`cli-args: ${call}: ${p.path} has a required flag, so it cannot hold commands`)
    }
    const key = scopeKey(p.handle, name)
    if (this.children.has(key)) {
      return Err(`cli-args: ${call}: ${p.path} already has a command '${name}'`)
    }
    p.group = true
    const c = new CommandRec(
      toI32(this.cmds.length),
      name,
      p.handle,
      p.path,
      id,
      description,
      group,
      `${p.path} ${name}`
    )
    this.children.set(key, c)
    this.cmds.push(c)
    return Ok(c)
  }

  /**
   * `group`, answering a mistake rather than panicking on it.
   *
   * @param parent the handle of the group (or `ROOT`) the group goes in
   * @param name the word that names the group on the command line
   * @param description the group's line in its parent's help, and in its own
   * @returns the group's handle, or the error `group` would panic with, and
   *   then the tree is unchanged
   */
  tryGroup(parent: i32, name: string, description: string): Result<i32, string> {
    const c = this.addCommand(`group(${name})`, parent, name, GROUP_ID, description, true)
    if (c.isErr()) {
      return Err(c.error)
    }
    return Ok(c.value.handle)
  }

  /**
   * A group under `parent`: it holds commands, and naming it without one is
   * an error.
   *
   * @param parent the handle of the group (or `ROOT`) the group goes in;
   *   panics on a command, or on one that takes arguments or a required flag
   * @param name the word that names the group on the command line; panics
   *   when it is empty, has a space or `=`, starts with `-`, or is already a
   *   name in `parent`
   * @param description the group's line in its parent's help, and in its own
   * @returns the group's handle, for `command`, `group`, `flag`, `alias` and
   *   `epilog`
   */
  group(parent: i32, name: string, description: string): i32 {
    const c = this.tryGroup(parent, name, description)
    if (c.isErr()) {
      // A declaration mistake, which the program's own code makes.
      panic(c.error)
    }
    return c.value
  }

  /**
   * `command`, answering a mistake rather than panicking on it.
   *
   * @param parent the handle of the group (or `ROOT`) the command goes in
   * @param name the word that names the command on the command line
   * @param id what `ParseResult.id` answers when the arguments name this
   *   command: not negative, and no other command's
   * @param description the command's line in its parent's help, and in its
   *   own usage line
   * @returns the command's handle, or the error `command` would panic with,
   *   and then the tree is unchanged
   */
  tryCommand(parent: i32, name: string, id: i32, description: string): Result<i32, string> {
    const call = `command(${name})`
    if (id < 0) {
      return Err(`cli-args: ${call}: the id ${id} is negative, which a group answers`)
    }
    const key = `${id}`
    const other = this.ids.get(key)
    if (other !== undefined) {
      return Err(`cli-args: ${call}: ${other.path} already has the id ${id}`)
    }
    const c = this.addCommand(call, parent, name, id, description, false)
    if (c.isErr()) {
      return Err(c.error)
    }
    this.ids.set(key, c.value)
    return Ok(c.value.handle)
  }

  /**
   * A command under `parent` that the program runs, answered by `id` in
   * `ParseResult.id`: not negative, which is a group's, and no other command's.
   *
   * @param parent the handle of the group (or `ROOT`) the command goes in;
   *   panics on a command, or on one that takes arguments or a required flag
   * @param name the word that names the command on the command line; panics
   *   when it is empty, has a space or `=`, starts with `-`, or is already a
   *   name in `parent`
   * @param id what `ParseResult.id` answers when the arguments name this
   *   command, so the program can switch on it; panics when negative or
   *   already another command's
   * @param description the command's line in its parent's help, and in its
   *   own usage line
   * @returns the command's handle, for `flag`, `argument`, `alias` and
   *   `epilog`
   */
  command(parent: i32, name: string, id: i32, description: string): i32 {
    const c = this.tryCommand(parent, name, id, description)
    if (c.isErr()) {
      // A declaration mistake, which the program's own code makes.
      panic(c.error)
    }
    return c.value
  }

  /**
   * `alias`, answering a mistake rather than panicking on it.
   *
   * @param handle the command or group the alias names
   * @param name the other word, which the parent's help lists beside the
   *   first
   * @returns nothing, or the error `alias` would panic with, and then the
   *   tree is unchanged
   */
  tryAlias(handle: i32, name: string): Result<void, string> {
    const call = `alias(${name})`
    const at = this.commandAt(call, handle)
    if (at.isErr()) {
      return Err(at.error)
    }
    const c = at.value
    if (c.handle === ROOT) {
      return Err(`cli-args: ${call}: the root has no alias`)
    }
    if (!isWord(name)) {
      return Err(`cli-args: ${call}: '${name}' is not a command name`)
    }
    const key = scopeKey(c.parent, name)
    if (this.children.has(key)) {
      return Err(`cli-args: ${call}: ${c.parentPath} already has a command '${name}'`)
    }
    c.aliases = c.aliases.length > 0 ? `${c.aliases}, ${name}` : name
    this.children.set(key, c)
    this.aliasList.push(new AliasRec(name, c.parent))
    return Ok()
  }

  /**
   * Another name for the command or group `handle`, in the same scope.
   *
   * @param handle the command or group the alias names; panics on `ROOT`
   *   or a handle no declaration answered
   * @param name the other word, which the parent's help lists beside the
   *   first; panics when it is not a command name or is already a name in
   *   that scope
   */
  alias(handle: i32, name: string): void {
    const r = this.tryAlias(handle, name)
    if (r.isErr()) {
      // A declaration mistake, which the program's own code makes.
      panic(r.error)
    }
  }

  /** Whether a flag of `scope` (a command, or `GLOBAL`) answers to `key`, as itself or as a negation. */
  private taken(scope: i32, key: string): boolean {
    const k = scopeKey(scope, key)
    return this.flags.has(k) || this.negations.has(k)
  }

  /** Whether `scope` already answers to any of `--long`, its negation (for `--no-x`), or `-short`. */
  private scopeHas(scope: i32, spec: FlagSpec): boolean {
    if (this.taken(scope, `--${spec.long}`) || (spec.negated && this.taken(scope, `--no-${spec.long}`))) {
      return true
    }
    return spec.short.length > 0 && this.taken(scope, `-${spec.short}`)
  }

  /** A new flag of `owner` (`scope`'s handle, or `GLOBAL`) from `spec`, or why it cannot be; `call` names the declaration in the error. */
  private addFlag(
    call: string,
    owner: i32,
    scope: CommandRec,
    spec: string,
    description: string
  ): Result<CliFlag, string> {
    const parsed = parseFlagSpec(call, spec)
    if (parsed.isErr()) {
      return Err(parsed.error)
    }
    const s = parsed.value
    if (s.long === "help" || s.long === "version" || s.short === "h" || s.short === "v") {
      return Err(`cli-args: ${call}: -h, --help, -v and --version are taken`)
    }
    if (this.scopeHas(owner, s)) {
      const where = owner === GLOBAL ? "the global flags" : scope.path
      return Err(`cli-args: ${call}: ${where} already has a flag of that name`)
    }
    if (owner === GLOBAL) {
      for (let i: i32 = 0; i < toI32(this.flagList.length); i++) {
        const f = this.flagList[i]
        if (
          f.answersTo(s.long) ||
          (s.negated && f.answersTo(`no-${s.long}`)) ||
          (s.short.length > 0 && f.short === s.short)
        ) {
          return Err(`cli-args: ${call}: ${f.scope.path} already has a flag of that name`)
        }
      }
    } else if (this.scopeHas(GLOBAL, s)) {
      return Err(`cli-args: ${call}: a global flag of that name is already declared`)
    }
    const f = new CliFlag(toI32(this.flagList.length), owner, scope, s, description)
    this.flags.set(scopeKey(owner, `--${s.long}`), f)
    if (s.negated) {
      this.negations.set(scopeKey(owner, `--no-${s.long}`), f)
    }
    if (s.short.length > 0) {
      this.flags.set(scopeKey(owner, `-${s.short}`), f)
    }
    this.flagList.push(f)
    return Ok(f)
  }

  /**
   * `globalFlag`, answering a mistake rather than panicking on it.
   *
   * @param spec the flag as the help writes it, in `globalFlag`'s syntax
   * @param description the flag's line in the `Global flags` help section
   * @returns the flag, for `ParseResult`'s `read` methods and, by its
   *   `handle`, for the methods that take one; or the error `globalFlag`
   *   would panic with, and then the tree is unchanged
   */
  tryGlobalFlag(spec: string, description: string): Result<CliFlag, string> {
    return this.addFlag(`globalFlag("${spec}")`, GLOBAL, this.root, spec, description)
  }

  /**
   * A flag every command takes, before, between or after the command names.
   *
   * @param spec the flag as the help writes it: `--name`, optionally after
   *   `-x, ` for a one-letter short form, optionally followed by ` <value>`
   *   (required) or ` [value]` (optional); `--no-x` with no value is a flag
   *   that is on until given. Panics on a malformed spec, on `-h`, `--help`,
   *   `-v` or `--version`, and on a name any flag already answers to
   * @param description the flag's line in the `Global flags` help section
   * @returns the flag's handle, for `ParseResult.flag`, `value`, `values`
   *   and `source`, and for `defaultValue`, `required`, `repeatable` and
   *   `negatable`
   */
  globalFlag(spec: string, description: string): i32 {
    const f = this.tryGlobalFlag(spec, description)
    if (f.isErr()) {
      // A declaration mistake, which the program's own code makes.
      panic(f.error)
    }
    return f.value.handle
  }

  /**
   * `flag`, answering a mistake rather than panicking on it.
   *
   * @param cmd the handle of the command or group (or `ROOT`) that owns the
   *   flag
   * @param spec the flag as the help writes it, in `globalFlag`'s syntax
   * @param description the flag's line in `cmd`'s `Flags` help section
   * @returns the flag, for `ParseResult`'s `read` methods and, by its
   *   `handle`, for the methods that take one; or the error `flag` would
   *   panic with, and then the tree is unchanged
   */
  tryFlag(cmd: i32, spec: string, description: string): Result<CliFlag, string> {
    const call = `flag("${spec}")`
    const at = this.commandAt(call, cmd)
    if (at.isErr()) {
      return Err(at.error)
    }
    return this.addFlag(call, at.value.handle, at.value, spec, description)
  }

  /**
   * A flag the command or group `cmd` takes, and no other.
   *
   * @param cmd the handle of the command or group (or `ROOT`) that owns the
   *   flag; the flag is unknown everywhere else in the tree
   * @param spec the flag as the help writes it, in `globalFlag`'s syntax;
   *   panics on a malformed spec, on `-h`, `--help`, `-v` or `--version`,
   *   and on a name `cmd` or a global flag already answers to
   * @param description the flag's line in `cmd`'s `Flags` help section
   * @returns the flag's handle, for `ParseResult.flag`, `value`, `values`
   *   and `source`, and for `defaultValue`, `required`, `repeatable` and
   *   `negatable`
   */
  flag(cmd: i32, spec: string, description: string): i32 {
    const f = this.tryFlag(cmd, spec, description)
    if (f.isErr()) {
      // A declaration mistake, which the program's own code makes.
      panic(f.error)
    }
    return f.value.handle
  }

  /**
   * `defaultValue`, answering a mistake rather than panicking on it.
   *
   * @param f the handle of a flag that takes a value and is not required
   * @param value what `value` and `values` answer when the arguments do not
   *   give the flag
   * @returns nothing, or the error `defaultValue` would panic with, and then
   *   the flag is unchanged
   */
  tryDefaultValue(f: i32, value: string): Result<void, string> {
    const call = `defaultValue(${value})`
    const at = this.flagAt(call, f)
    if (at.isErr()) {
      return Err(at.error)
    }
    const fl = at.value
    if (fl.value === VALUE_NONE) {
      return Err(`cli-args: ${call}: --${fl.long} takes no value`)
    }
    if (fl.required) {
      return Err(`cli-args: ${call}: --${fl.long} is required, so a default would never be read`)
    }
    fl.fallback = value
    fl.hasDefault = true
    return Ok()
  }

  /**
   * The value flag `f` answers when it is not given.
   *
   * @param f the handle of a flag that takes a value; panics on one that
   *   takes none or is required
   * @param value what `value` and `values` answer when the arguments do not
   *   give the flag, and what its help row shows as `(default: …)`; a later
   *   call replaces an earlier one
   */
  defaultValue(f: i32, value: string): void {
    const r = this.tryDefaultValue(f, value)
    if (r.isErr()) {
      // A declaration mistake, which the program's own code makes.
      panic(r.error)
    }
  }

  /**
   * `required`, answering a mistake rather than panicking on it.
   *
   * @param f the handle of a command's or a global flag without a default
   * @returns nothing, or the error `required` would panic with, and then the
   *   flag is unchanged
   */
  tryRequired(f: i32): Result<void, string> {
    const at = this.flagAt("required", f)
    if (at.isErr()) {
      return Err(at.error)
    }
    const fl = at.value
    if (fl.owner !== GLOBAL && fl.scope.group) {
      return Err(`cli-args: required: ${fl.scope.path} holds commands, so --${fl.long} can never be checked`)
    }
    if (fl.hasDefault) {
      return Err(`cli-args: required: --${fl.long} has a default, so it can never be missing`)
    }
    if (!fl.required) {
      fl.required = true
      this.requiredFlags.push(fl)
      if (fl.owner !== GLOBAL) {
        fl.scope.hasRequired = true
      }
    }
    return Ok()
  }

  /**
   * Makes `f` an error to leave out, for the command that owns it (every
   * command, for a global); a group's flag cannot be, as no parse ends at one.
   *
   * @param f the handle of the flag; panics on a group's flag or one with a
   *   default. Calling it twice is the same as once
   */
  required(f: i32): void {
    const r = this.tryRequired(f)
    if (r.isErr()) {
      // A declaration mistake, which the program's own code makes.
      panic(r.error)
    }
  }

  /**
   * `repeatable`, answering a mistake rather than panicking on it.
   *
   * @param f the handle of a flag that takes a value
   * @returns nothing, or the error `repeatable` would panic with, and then
   *   the flag is unchanged
   */
  tryRepeatable(f: i32): Result<void, string> {
    const at = this.flagAt("repeatable", f)
    if (at.isErr()) {
      return Err(at.error)
    }
    const fl = at.value
    if (fl.value === VALUE_NONE) {
      return Err(`cli-args: repeatable: --${fl.long} takes no value`)
    }
    fl.repeatable = true
    return Ok()
  }

  /**
   * Makes `f` gather every value it is given, in order, for
   * `ParseResult.values`.
   *
   * @param f the handle of a flag that takes a value; panics on one that
   *   takes none
   */
  repeatable(f: i32): void {
    const r = this.tryRepeatable(f)
    if (r.isErr()) {
      // A declaration mistake, which the program's own code makes.
      panic(r.error)
    }
  }

  /**
   * `negatable`, answering a mistake rather than panicking on it.
   *
   * @param f the handle of a flag declared `--x` with no value
   * @returns nothing, or the error `negatable` would panic with, and then
   *   the flag is unchanged
   */
  tryNegatable(f: i32): Result<void, string> {
    const at = this.flagAt("negatable", f)
    if (at.isErr()) {
      return Err(at.error)
    }
    const fl = at.value
    const call = `negatable(--${fl.long})`
    if (fl.value !== VALUE_NONE || fl.negated) {
      return Err(`cli-args: ${call}: only a boolean flag declared '--name' can be negated`)
    }
    const owner = fl.owner
    const name = `no-${fl.long}`
    let clash = this.taken(owner, `--${name}`) || (owner !== GLOBAL && this.taken(GLOBAL, `--${name}`))
    for (let g: i32 = 0; g < toI32(this.flagList.length) && owner === GLOBAL && !clash; g++) {
      clash = this.flagList[g].answersTo(name)
    }
    if (clash) {
      return Err(`cli-args: ${call}: --${name} is already declared`)
    }
    this.negations.set(scopeKey(owner, `--${name}`), fl)
    // Marked last, or `answersTo` above would take `fl` for a clash with itself.
    fl.negatable = true
    return Ok()
  }

  /**
   * Adds `--no-x` to the boolean flag `--x`, which turns it back off.
   *
   * @param f the handle of a flag declared `--x` with no value; panics on a
   *   flag that takes a value, one declared `--no-x`, or when `--no-x` is
   *   already a name a flag in its reach answers to
   */
  negatable(f: i32): void {
    const r = this.tryNegatable(f)
    if (r.isErr()) {
      // A declaration mistake, which the program's own code makes.
      panic(r.error)
    }
  }

  /**
   * `argument`, answering a mistake rather than panicking on it.
   *
   * @param cmd the handle of the command that takes the argument
   * @param spec the argument as the help writes it, in `argument`'s forms
   * @param description the argument's line in `cmd`'s `Arguments` help
   *   section
   * @returns the argument, for `ParseResult.readPositional` and
   *   `readPositionals` and, by its `handle`, for `positional` and
   *   `positionals`; or the error `argument` would panic with, and then the
   *   tree is unchanged
   */
  tryArgument(cmd: i32, spec: string, description: string): Result<CliArgument, string> {
    const call = `argument("${spec}")`
    const at = this.commandAt(call, cmd)
    if (at.isErr()) {
      return Err(at.error)
    }
    const c = at.value
    if (c.group) {
      return Err(`cli-args: ${call}: ${c.path} holds commands, so it takes no arguments`)
    }
    const required = spec.startsWith("<") && spec.endsWith(">")
    if (!required && !(spec.startsWith("[") && spec.endsWith("]"))) {
      return Err(`cli-args: ${call}: bad argument spec: an argument is written <name> or [name]`)
    }
    let name = spec.substring(1, spec.length - 1)
    const variadic = name.endsWith("...")
    if (variadic) {
      name = name.substring(0, name.length - 3)
    }
    if (!isWord(name)) {
      return Err(
        `cli-args: ${call}: bad argument spec: the name is empty or has a space, '=' or leading dash`
      )
    }
    if (c.variadic) {
      return Err(`cli-args: ${call}: no argument may follow a variadic one`)
    }
    if (required && c.optionalArg) {
      return Err(`cli-args: ${call}: a required argument may not follow an optional one`)
    }
    const a = new CliArgument(
      toI32(this.argList.length),
      c.handle,
      name,
      required,
      variadic,
      description,
      toI32(c.args.length)
    )
    c.args.push(a)
    c.variadic = variadic
    c.optionalArg = !required
    this.argList.push(a)
    return Ok(a)
  }

  /**
   * A positional argument of the command `cmd`: `<name>` required, `[name]`
   * optional, `<name...>` or `[name...]` taking every one left, last only.
   *
   * @param cmd the handle of the command that takes the argument; panics on
   *   a group, or on the root once it holds commands
   * @param spec the argument as the help writes it, one of the four forms
   *   above; panics on a malformed one, on any argument after a variadic one,
   *   and on a required one after an optional one
   * @param description the argument's line in `cmd`'s `Arguments` help
   *   section
   * @returns the argument's handle, for `ParseResult.positional` and
   *   `positionals`
   */
  argument(cmd: i32, spec: string, description: string): i32 {
    const a = this.tryArgument(cmd, spec, description)
    if (a.isErr()) {
      // A declaration mistake, which the program's own code makes.
      panic(a.error)
    }
    return a.value.handle
  }

  /**
   * `epilog`, answering a mistake rather than panicking on it.
   *
   * @param handle the command or group (or `ROOT`) whose help ends with it
   * @param text what follows a blank line after the last row
   * @returns nothing, or the error `epilog` would panic with on a handle no
   *   declaration answered
   */
  tryEpilog(handle: i32, text: string): Result<void, string> {
    const at = this.commandAt("epilog", handle)
    if (at.isErr()) {
      return Err(at.error)
    }
    at.value.epilog = text
    return Ok()
  }

  /**
   * Text shown at the end of the help of `handle` (a command or group), as
   * given.
   *
   * @param handle the command or group (or `ROOT`) whose help ends with it
   * @param text what follows a blank line after the last row; empty for
   *   none, and a later call replaces an earlier one
   */
  epilog(handle: i32, text: string): void {
    const r = this.tryEpilog(handle, text)
    if (r.isErr()) {
      // A handle no declaration answered: the program's own mistake.
      panic(r.error)
    }
  }

  /**
   * The flag `name` (dashes included) names in `table` at `cmd`: its own, then
   * a global; null for none. `table` is `flags`, or `negations` for `--no-x`.
   */
  private lookup(table: Map<string, CliFlag>, cmd: i32, name: string): CliFlag | null {
    const own = table.get(scopeKey(cmd, name))
    if (own !== undefined) {
      return own
    }
    const global = table.get(scopeKey(GLOBAL, name))
    return global !== undefined ? global : null
  }

  /** Every long flag `cmd` answers to, for a did-you-mean. */
  private longNames(cmd: i32): string[] {
    const names: string[] = []
    for (let i: i32 = 0; i < toI32(this.flagList.length); i++) {
      const f = this.flagList[i]
      if (f.owner === cmd || f.owner === GLOBAL) {
        names.push(`--${f.long}`)
        if (f.negatable) {
          names.push(`--no-${f.long}`)
        }
      }
    }
    names.push("--help")
    if (cmd === ROOT) {
      names.push("--version")
    }
    return names
  }

  /** @internal Called by `ParseResult`. The names `cmd`'s children answer to, in declaration order, then their aliases when `withAliases`. */
  childNames(cmd: i32, withAliases: boolean): string[] {
    const names: string[] = []
    for (let i: i32 = 0; i < toI32(this.cmds.length); i++) {
      const c = this.cmds[i]
      if (c.parent === cmd) {
        names.push(c.name)
      }
    }
    for (let i: i32 = 0; withAliases && i < toI32(this.aliasList.length); i++) {
      const al = this.aliasList[i]
      if (al.parent === cmd) {
        names.push(al.name)
      }
    }
    return names
  }

  /**
   * Parses `argv` from index `start` (1 for `process.argv`, past the
   * program's path) in one walk over it.
   *
   * @param argv the command line's words, which are only read
   * @param start how many leading words of `argv` to skip; a negative one
   *   skips none, and one at or past the end reads nothing, which at a root
   *   with commands is a missing-command error
   * @returns a fresh answer the caller owns, holding this tree to read its
   *   values by handle; a usage error is its `PARSE_ERROR` kind, never a
   *   panic
   */
  parse(argv: string[], start: i32): ParseResult {
    const r = new ParseResult(this)
    let i: i32 = start < 0 ? 0 : start
    let dashed = false
    while (i >= 0 && i < toI32(argv.length)) {
      const token = argv[i]
      i = i + 1
      if (dashed) {
        r.positionalValues.push(token)
        r.restValues.push(token)
      } else if (token === "--") {
        dashed = true
      } else if (token.length > 1 && toI32(token.charCodeAt(0)) === DASH) {
        i = token.startsWith("--") ? this.longFlag(r, argv, i, token) : this.shortFlags(r, argv, i, token)
      } else if (r.at.group && !r.badCommand) {
        const child = this.children.get(scopeKey(r.command, token))
        if (child !== undefined) {
          r.command = child.handle
          r.at = child
        } else if (r.command === ROOT && token === "help") {
          r.wantHelp = true
          r.helpWord = true
        } else {
          this.unknownCommand(r, token)
        }
      } else {
        r.positionalValues.push(token)
      }
    }
    r.finishWalk()
    return r
  }

  /** Records `token` as no command `r`'s group holds, with the nearest one that it does. */
  private unknownCommand(r: ParseResult, token: string): void {
    const near = closest(token, this.childNames(r.command, true))
    r.badCommand = true
    r.fail(
      r.at,
      near.length > 0 ? `unknown command '${token}' (did you mean '${near}'?)` : `unknown command '${token}'`
    )
  }

  /** Records `--name`, `--name=value`, `--name value` or `--no-name` from `token`; answers the next index. */
  private longFlag(r: ParseResult, argv: string[], next: i32, token: string): i32 {
    const eq: i32 = toI32(token.indexOf("="))
    const name = eq < 0 ? token : token.substring(0, eq)
    if (name === "--help") {
      r.wantHelp = true
      return next
    }
    if (name === "--version" && r.command === ROOT) {
      r.wantVersion = true
      return next
    }
    const f = this.lookup(this.flags, r.command, name)
    if (f !== null) {
      if (eq >= 0) {
        if (f.value === VALUE_NONE) {
          r.fail(r.at, `${name} takes no value`)
        } else {
          // From the `=` on, less the `=` itself: no index arithmetic.
          r.set(f, token.substring(eq).substring(1))
        }
        return next
      }
      return this.takeValue(r, argv, next, f, "")
    }
    const off = this.lookup(this.negations, r.command, name)
    if (off !== null) {
      if (eq >= 0) {
        r.fail(r.at, `${name} takes no value`)
      } else {
        r.set(off, "false")
      }
      return next
    }
    const near = closest(name, this.longNames(r.command))
    r.fail(r.at, near.length > 0 ? `unknown flag ${name} (did you mean ${near}?)` : `unknown flag ${name}`)
    return next
  }

  /** Records the cluster `-abc` (or `-l5`, `-l=5`, `-l 5`) from `token`; answers the next index. */
  private shortFlags(r: ParseResult, argv: string[], next: i32, token: string): i32 {
    for (let k: i32 = 1; k < toI32(token.length); k++) {
      const letter = token.substring(k, k + 1)
      if (letter === "h") {
        r.wantHelp = true
      } else if (letter === "v" && r.command === ROOT) {
        r.wantVersion = true
      } else {
        const f = this.lookup(this.flags, r.command, `-${letter}`)
        if (f === null) {
          r.fail(r.at, `unknown flag -${letter}`)
          return next
        }
        const attached = token.substring(k + 1, token.length)
        if (f.value !== VALUE_NONE) {
          if (attached.startsWith("=")) {
            r.set(f, attached.substring(1, attached.length))
            return next
          }
          return this.takeValue(r, argv, next, f, attached)
        }
        if (attached.startsWith("=")) {
          r.fail(r.at, `-${letter} takes no value`)
          return next
        }
        r.set(f, f.negated ? "false" : "true")
      }
    }
    return next
  }

  /**
   * Records flag `f` as given, with `attached` (from `-l5`) as its value when
   * not empty, or else the token at `next` when the flag's value takes it;
   * answers the index after whatever it took.
   */
  private takeValue(r: ParseResult, argv: string[], next: i32, f: CliFlag, attached: string): i32 {
    if (f.value === VALUE_NONE) {
      r.set(f, "true")
      return next
    }
    if (attached.length > 0) {
      r.set(f, attached)
      return next
    }
    if (next >= 0 && next < toI32(argv.length)) {
      const word = argv[next]
      const after: i32 = next + 1
      if (f.value === VALUE_REQUIRED || !(word.length > 0 && toI32(word.charCodeAt(0)) === DASH)) {
        r.set(f, word)
        return after
      }
    } else if (f.value === VALUE_REQUIRED) {
      r.fail(r.at, `--${f.long} needs a value`)
      return next
    }
    r.set(f, "")
    return next
  }

  /** A help row's flag column for `f`: `-s, --long`, with `--[no-]x` for a negatable one. */
  private flagLabel(f: CliFlag): string {
    const long = f.negatable ? `--[no-]${f.long}` : f.spelling()
    return f.short.length > 0 ? `-${f.short}, ${long}` : long
  }

  /** A help row's description for `f`, with what it is: repeatable, its default, required. */
  private flagText(f: CliFlag): string {
    let text = f.description
    if (f.repeatable) {
      text = `${text} (repeatable)`
    }
    if (f.hasDefault) {
      text = `${text} (default: ${f.fallback})`
    }
    if (f.required) {
      text = `${text} (required)`
    }
    return text
  }

  /** Adds a `section` row to `rows` for every flag `owner` (a command, or `GLOBAL`) declares. */
  private flagRows(rows: HelpRow[], section: string, owner: i32): void {
    for (let i: i32 = 0; i < toI32(this.flagList.length); i++) {
      const f = this.flagList[i]
      if (f.owner === owner) {
        rows.push(new HelpRow(section, this.flagLabel(f), f.meta, this.flagText(f)))
      }
    }
  }

  /** @internal Called by `ParseResult`. The help of the command or group `c`, painted with `style`. */
  helpOf(c: CommandRec, style: Style): string {
    const rows: HelpRow[] = []
    const shape: string[] = []
    if (c.handle !== ROOT) {
      // The path past the program's name and the space after it.
      shape.push(c.path.substring(this.name.length).substring(1))
    }
    if (c.group) {
      shape.push("<command>")
      for (let i: i32 = 0; i < toI32(this.cmds.length); i++) {
        const child = this.cmds[i]
        if (child.parent === c.handle) {
          const label = child.aliases.length > 0 ? `${child.name}, ${child.aliases}` : child.name
          rows.push(new HelpRow("Commands", label, "", child.description))
        }
      }
    }
    for (let i: i32 = 0; i < toI32(c.args.length); i++) {
      const a = c.args[i]
      const dots = a.variadic ? "..." : ""
      const label = a.required ? `<${a.name}${dots}>` : `[${a.name}${dots}]`
      shape.push(label)
      rows.push(new HelpRow("Arguments", label, "", a.description))
    }
    shape.push("[flags]")
    this.flagRows(rows, "Flags", c.handle)
    rows.push(new HelpRow("Flags", "-h, --help", "", "show help"))
    if (c.handle === ROOT) {
      rows.push(new HelpRow("Flags", "-v, --version", "", "show the version"))
    }
    this.flagRows(rows, "Global flags", GLOBAL)
    // The description column: two past the widest row, at most `MAX_COLUMN`.
    // A row at least that wide sets it to the most, so only a narrower one's
    // width is added up, from lengths each below `MAX_COLUMN`.
    let column: i32 = 2
    for (let i: i32 = 0; i < toI32(rows.length) && column < MAX_COLUMN; i++) {
      const row = rows[i]
      // Two lengths and a few columns fit an i64, which no row reaches.
      const width: i64 =
        row.meta.length > 0
          ? toI64(toI32(row.label.length)) + toI64(toI32(row.meta.length)) + toI64(5)
          : toI64(toI32(row.label.length)) + toI64(4)
      if (width >= toI64(MAX_COLUMN)) {
        column = MAX_COLUMN
      } else if (width > toI64(column)) {
        column = toI32(width)
      }
    }
    const usage = shape.join(" ")
    const menu = new HelpMenu(style, this.name, column, column)
    menu.header(this.version, this.description)
    // The usage line, its description three spaces after the shape: one
    // line, so it is laid out here rather than against a usage column.
    const said = c.handle !== ROOT && c.description.length > 0 ? `   ${style.dim(c.description)}` : ""
    menu.line(`${style.heading("usage:")} ${style.name(this.name)} ${style.flag(usage)}${said}`)
    let open = ""
    for (let i: i32 = 0; i < toI32(rows.length); i++) {
      const row = rows[i]
      if (row.section !== open) {
        open = row.section
        menu.section(open)
      }
      menu.row(row.label, row.meta, row.text)
    }
    if (c.epilog.length > 0) {
      menu.line("")
      menu.line(c.epilog)
    }
    return menu.text()
  }

  /**
   * The help of the command or group `handle`, painted with `style`.
   *
   * @param handle the command or group (or `ROOT`) whose help it is; panics
   *   on a handle no declaration answered
   * @param style how the help's names and headings are painted; a style
   *   that is off gives plain text
   * @returns a fresh string, the whole page, built on each call
   */
  helpText(handle: i32, style: Style): string {
    const c = this.commandAt("help", handle)
    if (c.isErr()) {
      // A handle no declaration answered: the program's own mistake.
      panic(c.error)
    }
    return this.helpOf(c.value, style)
  }
}

/** One row of a help page, kept until the widest row sets the column. */
class HelpRow {
  /** @internal Used by `Cli`. */
  section: string
  /** @internal Used by `Cli`. */
  label: string
  /** @internal Used by `Cli`. */
  meta: string
  /** @internal Used by `Cli`. */
  text: string

  constructor(section: string, label: string, meta: string, text: string) {
    this.section = section
    this.label = label
    this.meta = meta
    this.text = text
  }
}

/** One flag the arguments gave, and the value it was given. */
class FlagSet {
  /** @internal Used by `ParseResult`. */
  flag: i32
  /** @internal Used by `ParseResult`. */
  value: string

  constructor(flag: i32, value: string) {
    this.flag = flag
    this.value = value
  }
}

/**
 * What `Cli.parse` found: the command the arguments name and every value
 * they set, or that they ask for help or the version, or what is wrong with
 * them. Values are read by the handles the tree was declared with, or by the
 * `CliFlag` and `CliArgument` its `try` twins answered.
 */
export class ParseResult {
  private cli: Cli
  /** The command line that names it: `api users keys list`. */
  path: string
  /** The error line for `PARSE_ERROR`, the version line for `PARSE_VERSION`, else empty. */
  message: string
  /** The line after an error that says where the usage is; empty without one. */
  hint: string
  /** The command line of the command an error was found at; empty without one. */
  errorPath: string
  private sets: FlagSet[]
  /** @internal Used by `Cli`. */
  positionalValues: string[]
  /** @internal Used by `Cli`. */
  restValues: string[]
  /** `PARSE_OK`, `PARSE_HELP`, `PARSE_VERSION` or `PARSE_ERROR`. */
  kind: i32
  /** The handle of the deepest command the arguments reached. */
  command: i32
  /** @internal Used by `Cli`. The record of `command`. */
  at: CommandRec
  /** That command's id, or -1 for a group. */
  id: i32
  /** The status to exit with: 2 for an error, 0 otherwise. */
  exitCode: i32
  /** @internal Used by `Cli`. */
  wantHelp: boolean
  /** @internal Used by `Cli`. Whether help was asked for by the word `help`, which a path follows. */
  helpWord: boolean
  /** @internal Used by `Cli`. Whether a word named no command, which `help <path>` does not forgive. */
  badCommand: boolean
  /** @internal Used by `Cli`. */
  wantVersion: boolean

  /**
   * An answer that has read nothing: kind `PARSE_OK` at `ROOT` with no
   * values. `Cli.parse` makes one and fills it in; a program gets its
   * answer from there rather than building one.
   *
   * @param cli the tree the answer's handles belong to; it is kept, not
   *   copied
   */
  constructor(cli: Cli) {
    this.cli = cli
    this.kind = PARSE_OK
    this.command = ROOT
    this.at = cli.root
    this.id = GROUP_ID
    this.path = ""
    this.message = ""
    this.hint = ""
    this.exitCode = 0
    this.errorPath = ""
    this.wantHelp = false
    this.helpWord = false
    this.badCommand = false
    this.wantVersion = false
    this.sets = []
    this.positionalValues = []
    this.restValues = []
  }

  /** @internal Called by `Cli`. Records `text` as the error found at `at`, unless one is already recorded: the first wins. */
  fail(at: CommandRec, text: string): void {
    if (this.message.length === 0) {
      this.errorPath = at.path
      this.message = `${this.errorPath}: ${text}`
      this.hint = usageHint(`${this.errorPath} --help`)
    }
  }

  /** @internal Called by `Cli`. Records flag `f` as given `value`. */
  set(f: CliFlag, value: string): void {
    this.sets.push(new FlagSet(f.handle, value))
  }

  /**
   * @internal Called by `Cli`.
   * Settles the kind once the walk is over: help (unless `help <path>` named
   * no command), then the version, then an error, then the checks only a
   * whole command line can fail.
   */
  finishWalk(): void {
    const cli = this.cli
    const at = this.at
    this.id = at.id
    this.path = at.path
    if (this.wantHelp && !(this.helpWord && this.badCommand)) {
      this.kind = PARSE_HELP
      this.message = ""
      this.hint = ""
      return
    }
    if (this.wantVersion && !this.wantHelp) {
      this.kind = PARSE_VERSION
      this.message = `${cli.name} ${cli.version}`
      this.hint = ""
      return
    }
    if (at.group) {
      this.fail(at, `missing command (one of: ${cli.childNames(at.handle, false).join(", ")})`)
    }
    let missing = this.firstMissing(at.handle)
    if (missing === null) {
      missing = this.firstMissing(GLOBAL)
    }
    if (missing !== null) {
      this.fail(at, `missing required flag ${missing.spelling()}`)
    }
    for (let i: i32 = 0; i < toI32(at.args.length) && this.message.length === 0; i++) {
      const a = at.args[i]
      if (a.required && a.index >= toI32(this.positionalValues.length)) {
        const dots = a.variadic ? "..." : ""
        this.fail(at, `missing argument <${a.name}${dots}>`)
      }
    }
    // The positionals the arguments take: every one for a variadic last
    // argument, else one each.
    const taken: i32 = at.variadic ? toI32(this.positionalValues.length) : toI32(at.args.length)
    if (this.message.length === 0 && taken >= 0 && taken < toI32(this.positionalValues.length)) {
      this.fail(at, `unexpected argument '${this.positionalValues[taken]}'`)
    }
    if (this.message.length > 0) {
      this.kind = PARSE_ERROR
      this.exitCode = 2
    }
  }

  /** The first required flag of `owner` (a command, or `GLOBAL`) the arguments did not set, else null. */
  private firstMissing(owner: i32): CliFlag | null {
    const required = this.cli.requiredFlags
    for (let i: i32 = 0; i < toI32(required.length); i++) {
      const f = required[i]
      if (f.owner === owner && this.lastValue(f.handle) === null) {
        return f
      }
    }
    return null
  }

  /**
   * The last value the arguments gave flag `f`, or null when they did not
   * give it: a scan of the flags they set, so bounded by their count.
   */
  private lastValue(f: i32): string | null {
    let found: string | null = null
    for (let i: i32 = 0; i < toI32(this.sets.length); i++) {
      const s = this.sets[i]
      if (s.flag === f) {
        found = s.value
      }
    }
    return found
  }

  /**
   * Whether flag `f` is on: a boolean's value (true by default for one
   * declared `--no-x`), or for a flag with a value, whether it was given.
   *
   * @param f a flag `Cli.tryFlag` or `Cli.tryGlobalFlag` answered
   * @returns the last of the arguments' settings for a boolean, so
   *   `--x --no-x` is off
   */
  readFlag(f: CliFlag): boolean {
    const given = this.lastValue(f.handle)
    if (f.value !== VALUE_NONE) {
      return given !== null
    }
    return given !== null ? given === "true" : f.negated
  }

  /**
   * The value of flag `f`: the last one given (empty for `[value]` given
   * none), else its default, else null.
   *
   * @param f a flag `Cli.tryFlag` or `Cli.tryGlobalFlag` answered
   * @returns the value as written, or `"true"` or `"false"` for a boolean
   *   that was given; null tells a flag never given and with no default
   */
  readValue(f: CliFlag): string | null {
    const given = this.lastValue(f.handle)
    if (given !== null) {
      return given
    }
    return f.hasDefault ? f.fallback : null
  }

  /**
   * Every value of flag `f` in order for a repeatable one, the last alone
   * for any other, else its default alone, else none.
   *
   * @param f a flag `Cli.tryFlag` or `Cli.tryGlobalFlag` answered
   * @returns a fresh array the caller owns
   */
  readValues(f: CliFlag): string[] {
    const out: string[] = []
    if (f.repeatable) {
      for (let i: i32 = 0; i < toI32(this.sets.length); i++) {
        const s = this.sets[i]
        if (s.flag === f.handle) {
          out.push(s.value)
        }
      }
    } else {
      const given = this.lastValue(f.handle)
      if (given !== null) {
        out.push(given)
      }
    }
    if (out.length === 0 && f.hasDefault) {
      out.push(f.fallback)
    }
    return out
  }

  /**
   * Where flag `f`'s value came from: `SOURCE_ARGV`, `SOURCE_DEFAULT` or
   * `SOURCE_UNSET`.
   *
   * @param f a flag `Cli.tryFlag` or `Cli.tryGlobalFlag` answered
   * @returns `SOURCE_ARGV` when the arguments gave it, `SOURCE_DEFAULT` when
   *   it has a default or is declared `--no-x` (on by default), else
   *   `SOURCE_UNSET`
   */
  readSource(f: CliFlag): i32 {
    if (this.lastValue(f.handle) !== null) {
      return SOURCE_ARGV
    }
    return f.hasDefault || f.negated ? SOURCE_DEFAULT : SOURCE_UNSET
  }

  /**
   * The argument `a`'s value, or null when it was not given or belongs to
   * another command.
   *
   * @param a an argument `Cli.tryArgument` answered
   * @returns the word at the argument's place among the positionals, which
   *   for a variadic one is the first it took
   */
  readPositional(a: CliArgument): string | null {
    const k: i32 = a.index
    if (a.owner === this.command && k >= 0 && k < toI32(this.positionalValues.length)) {
      return this.positionalValues[k]
    }
    return null
  }

  /**
   * Every value from argument `a` on: all a variadic one took, or the one
   * value of any other.
   *
   * @param a an argument `Cli.tryArgument` answered
   * @returns a fresh array the caller owns; empty when the argument was not
   *   given or belongs to another command
   */
  readPositionals(a: CliArgument): string[] {
    const out: string[] = []
    if (a.owner !== this.command) {
      return out
    }
    for (let i: i32 = a.index; i >= 0 && i < toI32(this.positionalValues.length); i++) {
      out.push(this.positionalValues[i])
      if (!a.variadic) {
        break
      }
    }
    return out
  }

  /**
   * Whether flag `f` is on, as `readFlag` answers.
   *
   * @param f the handle of a flag anywhere in the tree; panics on a handle
   *   no declaration answered
   * @returns the last of the arguments' settings for a boolean, so
   *   `--x --no-x` is off
   */
  flag(f: i32): boolean {
    return this.readFlag(this.cli.checkFlag("flag", f))
  }

  /**
   * The value of flag `f`, as `readValue` answers.
   *
   * @param f the handle of a flag anywhere in the tree; panics on a handle
   *   no declaration answered
   * @returns the value as written, or `"true"` or `"false"` for a boolean
   *   that was given; null tells a flag never given and with no default
   */
  value(f: i32): string | null {
    return this.readValue(this.cli.checkFlag("value", f))
  }

  /**
   * Every value of flag `f`, as `readValues` answers.
   *
   * @param f the handle of a flag anywhere in the tree; panics on a handle
   *   no declaration answered
   * @returns a fresh array the caller owns
   */
  values(f: i32): string[] {
    return this.readValues(this.cli.checkFlag("values", f))
  }

  /**
   * Where flag `f`'s value came from, as `readSource` answers.
   *
   * @param f the handle of a flag anywhere in the tree; panics on a handle
   *   no declaration answered
   * @returns `SOURCE_ARGV` when the arguments gave it, `SOURCE_DEFAULT` when
   *   it has a default or is declared `--no-x` (on by default), else
   *   `SOURCE_UNSET`
   */
  source(f: i32): i32 {
    return this.readSource(this.cli.checkFlag("source", f))
  }

  /**
   * The argument `a`'s value, as `readPositional` answers.
   *
   * @param a the handle of an argument; panics on a handle no `argument`
   *   call answered
   * @returns the word at the argument's place among the positionals, which
   *   for a variadic one is the first it took
   */
  positional(a: i32): string | null {
    return this.readPositional(this.cli.checkArgument("positional", a))
  }

  /**
   * Every value from argument `a` on, as `readPositionals` answers.
   *
   * @param a the handle of an argument; panics on a handle no `argument`
   *   call answered
   * @returns a fresh array the caller owns; empty when the argument was not
   *   given or belongs to another command
   */
  positionals(a: i32): string[] {
    return this.readPositionals(this.cli.checkArgument("positionals", a))
  }

  /**
   * The tokens after `--`, in order. They are positionals too, so an
   * argument may also have taken them.
   *
   * @returns the answer's own array, not a copy: a change to it is seen by
   *   every later `rest` call
   */
  rest(): string[] {
    return this.restValues
  }

  /**
   * The help of the command the arguments reached, painted with `style`.
   *
   * @param style how the help's names and headings are painted; a style
   *   that is off gives plain text
   * @returns a fresh string, the whole page, built on each call
   */
  help(style: Style): string {
    return this.cli.helpOf(this.at, style)
  }
}

/** The pointer under an error line, naming `command` (`<path> --help`, painted or not). */
const usageHint = (command: string): string => `Run '${command}' for usage.`

/**
 * Acts on `r` for a program: help (painted with `outStyle`) or the version on
 * standard output and exit 0; an error line and the hint on standard error
 * and exit 2, the hint's command painted with `errStyle`, the error never;
 * answers 0 for `PARSE_OK`, which the program goes on to run.
 *
 * @param r the answer of `Cli.parse`
 * @param outStyle how help on standard output is painted
 * @param errStyle how the hint's `<path> --help` on standard error is
 *   painted
 * @returns 0, and only for `PARSE_OK`: every other kind exits instead
 */
export const finish = (r: ParseResult, outStyle: Style, errStyle: Style): i32 => {
  if (r.kind === PARSE_HELP) {
    console.log(r.help(outStyle))
    process.exit(0)
  } else if (r.kind === PARSE_VERSION) {
    console.log(r.message)
    process.exit(0)
  } else if (r.kind === PARSE_ERROR) {
    console.error(r.message)
    console.error(usageHint(errStyle.flag(`${r.errorPath} --help`)))
    process.exit(2)
  }
  return 0
}
