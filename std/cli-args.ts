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
 * declaration mistake panics at the call that made it.
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

/** No handle: a group's id, a command without arguments, the last argument's successor. */
const NONE: i32 = -1

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
 * The edit distance between `a` and `b` in bytes, a swap of two neighbours
 * counting as one edit (`kyes` is one from `keys`), worked in three rows the
 * caller sizes at least one longer than `b`. The rows are passed apart and
 * rotated, so no row is picked by an index.
 */
const editDistance = (a: string, b: string, rowA: i32[], rowB: i32[], rowC: i32[]): i32 => {
  for (let j: i32 = 0; j <= toI32(b.length) && j < toI32(rowA.length); j++) {
    rowA[j] = j
  }
  let twoUp = rowC
  let above = rowA
  let into = rowB
  // `k` is the row's index less one, so the loop ends on `<` and cannot wrap.
  for (let k: i32 = 0; k < toI32(a.length); k++) {
    // `closest` sizes every row one past the longest name, so a row is never
    // empty and the inner loop's row bounds never stop it before `b` ends.
    if (toI32(into.length) > 0) {
      into[0] = k + 1
    }
    for (
      let j: i32 = 1;
      j <= toI32(b.length) && j < toI32(into.length) && j < toI32(above.length) && j < toI32(twoUp.length);
      j++
    ) {
      const cost: i32 = a.charCodeAt(k) === b.charCodeAt(j - 1) ? 0 : 1
      // Widened: a cell holds at most the longer string's length, so the sum
      // fits an i64 and narrowing it back to i32 keeps it whole.
      let d: i64 = minI64(
        minI64(toI64(above[j]) + toI64(1), toI64(into[j - 1]) + toI64(1)),
        toI64(above[j - 1]) + toI64(cost)
      )
      if (
        k > 0 &&
        j > 1 &&
        a.charCodeAt(k) === b.charCodeAt(j - 2) &&
        a.charCodeAt(k - 1) === b.charCodeAt(j - 1)
      ) {
        d = minI64(d, toI64(twoUp[j - 2]) + toI64(1))
      }
      into[j] = toI32(d)
    }
    const done = twoUp
    twoUp = above
    above = into
    into = done
  }
  // `above` is the row the last pass wrote, or `rowA` when `a` is empty.
  const n: i32 = toI32(b.length)
  return n >= 0 && n < toI32(above.length) ? above[n] : n
}

/**
 * The candidate in `names` closest to `typed`, or empty when none is within
 * `max(2, w / 3)` edits for a `typed` of `w` bytes past its dashes; the first
 * declared wins a tie.
 */
const closest = (typed: string, names: string[]): string => {
  let longest: i32 = 0
  for (let i: i32 = 0; i < toI32(names.length); i++) {
    longest = toI32(names[i].length) > longest ? toI32(names[i].length) : longest
  }
  const rowA: i32[] = []
  const rowB: i32[] = []
  const rowC: i32[] = []
  for (let j: i32 = 0; j >= 0 && j <= longest; j++) {
    rowA.push(j)
    rowB.push(j)
    rowC.push(j)
    // A name's length is below i32's top, so `j` stops before it could wrap.
    if (j >= longest) {
      break
    }
  }
  let dashes: i32 = 0
  while (dashes < toI32(typed.length) && toI32(typed.charCodeAt(dashes)) === DASH) {
    dashes = dashes + 1
  }
  const third: i32 = (toI32(typed.length) - dashes) / 3
  let best: i32 = third > 2 ? third : 2
  let at: i32 = -1
  for (let i: i32 = 0; i < toI32(names.length); i++) {
    const d = editDistance(typed, names[i], rowA, rowB, rowC)
    if (d <= best && (at < 0 || d < best)) {
      best = d
      at = i
    }
  }
  return at >= 0 && at < toI32(names.length) ? names[at] : ""
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

  constructor(call: string, spec: string) {
    let rest = spec
    this.short = ""
    if (rest.startsWith("-") && !rest.startsWith("--")) {
      if (!(rest.length >= 6 && rest.substring(2, 4) === ", ")) {
        panic(`cli-args: ${call}: bad flag spec '${spec}': a short flag is one letter, then ', --name'`)
      }
      this.short = rest.substring(1, 2)
      if (!isWord(this.short)) {
        panic(`cli-args: ${call}: bad flag spec '${spec}': the short flag is not a letter`)
      }
      rest = rest.substring(4)
    }
    if (!rest.startsWith("--")) {
      panic(`cli-args: ${call}: bad flag spec '${spec}': a flag is written '--name'`)
    }
    const space: i32 = toI32(rest.indexOf(" "))
    this.long = space < 0 ? rest.substring(2) : rest.substring(2, space)
    // A space `indexOf` found lies inside `rest`, so `space + 1` cannot wrap.
    this.meta = space >= 0 && space < toI32(rest.length) ? rest.substring(space + 1) : ""
    if (!isWord(this.long)) {
      panic(
        `cli-args: ${call}: bad flag spec '${spec}': the name is empty or has a space, '=' or leading dash`
      )
    }
    this.value = VALUE_NONE
    if (this.meta.length > 0) {
      const inner = this.meta.substring(1, this.meta.length - 1)
      if (this.meta.startsWith("<") && this.meta.endsWith(">") && isWord(inner)) {
        this.value = VALUE_REQUIRED
      } else if (this.meta.startsWith("[") && this.meta.endsWith("]") && isWord(inner)) {
        this.value = VALUE_OPTIONAL
      } else {
        panic(`cli-args: ${call}: bad flag spec '${spec}': a value is written <value> or [value]`)
      }
    }
    this.negated = this.value === VALUE_NONE && this.long.startsWith("no-") && this.long.length > 3
    if (this.negated) {
      this.long = this.long.substring(3)
    }
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

  // The cmd* arrays hold one entry per command, the flag* arrays one per flag
  // and the arg* arrays one per argument: each declaration pushes to every
  // array of its kind at once. So a handle inside one lies inside all of its
  // kind, and the range re-tests marked "parallel arrays" below never fail;
  // they are written out because the bounds proof does not know the arrays
  // grow together, and are placed after the last call before the reads, which
  // the proof forgets a test across.
  private cmdName: string[]
  private cmdParent: i32[]
  /** @internal Used by `ParseResult`. */
  cmdId: i32[]
  private cmdDesc: string[]
  /** @internal Used by `ParseResult`. */
  cmdGroup: boolean[]
  private cmdPath: string[]
  private cmdAliases: string[]
  private aliasOwner: i32[]
  private aliasName: string[]
  private cmdEpilog: string[]
  /** @internal Used by `ParseResult`. */
  cmdFirstArg: i32[]
  private cmdLastArg: i32[]
  private cmdVariadic: boolean[]
  private cmdOptionalArg: boolean[]
  private children: Map<string, i32>

  private flagOwner: i32[]
  private flagShort: string[]
  private flagLong: string[]
  private flagMeta: string[]
  /** @internal Used by `ParseResult`. */
  flagValue: i32[]
  /** @internal Used by `ParseResult`. */
  flagNegated: boolean[]
  private flagNegatable: boolean[]
  private flagDesc: string[]
  /** @internal Used by `ParseResult`. */
  flagDefault: string[]
  /** @internal Used by `ParseResult`. */
  flagHasDefault: boolean[]
  private flagRequired: boolean[]
  /** @internal Used by `ParseResult`. */
  flagRepeatable: boolean[]
  private flags: Map<string, i32>
  private negations: Map<string, i32>
  /** @internal Used by `ParseResult`. */
  cmdRequired: i32[][]
  /** @internal Used by `ParseResult`. */
  globalRequired: i32[]
  private ids: Map<string, i32>

  /** @internal Used by `ParseResult`. */
  argOwner: i32[]
  /** @internal Used by `ParseResult`. */
  argName: string[]
  /** @internal Used by `ParseResult`. */
  argRequired: boolean[]
  /** @internal Used by `ParseResult`. */
  argVariadic: boolean[]
  private argDesc: string[]
  /** @internal Used by `ParseResult`. */
  argIndex: i32[]
  /** @internal Used by `ParseResult`. */
  argNext: i32[]

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
    this.cmdName = [name]
    this.cmdParent = [-1]
    this.cmdId = [-1]
    this.cmdDesc = [description]
    this.cmdGroup = [false]
    this.cmdPath = [name]
    this.cmdAliases = [""]
    this.aliasOwner = []
    this.aliasName = []
    this.cmdEpilog = [""]
    this.cmdFirstArg = [-1]
    this.cmdLastArg = [-1]
    this.cmdVariadic = [false]
    this.cmdOptionalArg = [false]
    this.cmdRequired = [[]]
    this.children = new Map<string, i32>()
    this.flagOwner = []
    this.flagShort = []
    this.flagLong = []
    this.flagMeta = []
    this.flagValue = []
    this.flagNegated = []
    this.flagNegatable = []
    this.flagDesc = []
    this.flagDefault = []
    this.flagHasDefault = []
    this.flagRequired = []
    this.flagRepeatable = []
    this.flags = new Map<string, i32>()
    this.negations = new Map<string, i32>()
    this.globalRequired = []
    this.ids = new Map<string, i32>()
    this.argOwner = []
    this.argName = []
    this.argRequired = []
    this.argVariadic = []
    this.argDesc = []
    this.argIndex = []
    this.argNext = []
  }

  /** The command `handle`, or a panic naming `call` when there is none. */
  private checkCommand(call: string, handle: i32): i32 {
    if (!(handle >= 0 && handle < toI32(this.cmdName.length))) {
      panic(`cli-args: ${call}: ${handle} is not a command handle`)
    }
    return handle
  }

  /** @internal Called by `ParseResult`. The flag `handle`, or a panic naming `call` when there is none. */
  checkFlag(call: string, handle: i32): i32 {
    if (!(handle >= 0 && handle < toI32(this.flagLong.length))) {
      panic(`cli-args: ${call}: ${handle} is not a flag handle`)
    }
    return handle
  }

  /** @internal Called by `ParseResult`. The argument `handle`, or a panic naming `call` when there is none. */
  checkArgument(call: string, handle: i32): i32 {
    if (!(handle >= 0 && handle < toI32(this.argName.length))) {
      panic(`cli-args: ${call}: ${handle} is not an argument handle`)
    }
    return handle
  }

  /** @internal Called by `ParseResult`. The command line that names `handle`: the program, then each command down to it. */
  pathOf(handle: i32): string {
    const h = this.checkCommand("path", handle)
    // Parallel arrays: always in range.
    return h >= 0 && h < toI32(this.cmdPath.length) ? this.cmdPath[h] : this.name
  }

  /** @internal Called by nothing. Whether `handle` holds commands rather than running: a group, or a root given children. */
  isGroup(handle: i32): boolean {
    const h = this.checkCommand("isGroup", handle)
    // Parallel arrays: always in range.
    return h >= 0 && h < toI32(this.cmdGroup.length) && this.cmdGroup[h]
  }

  /** A new child of `parent`; `call` names the declaration in a panic. */
  private addCommand(
    call: string,
    parent: i32,
    name: string,
    id: i32,
    description: string,
    group: boolean
  ): i32 {
    const p = this.checkCommand(call, parent)
    if (!isWord(name)) {
      panic(`cli-args: ${call}: '${name}' is not a command name`)
    }
    // Parallel arrays: never returns.
    if (
      !(
        p >= 0 &&
        p < toI32(this.cmdGroup.length) &&
        p < toI32(this.cmdFirstArg.length) &&
        p < toI32(this.cmdRequired.length) &&
        p < toI32(this.cmdPath.length)
      )
    ) {
      return NONE
    }
    const path = `${this.cmdPath[p]} ${name}`
    if (p !== ROOT && !this.cmdGroup[p]) {
      panic(`cli-args: ${call}: ${this.pathOf(p)} is a command, not a group`)
    }
    if (this.cmdFirstArg[p] >= 0) {
      panic(`cli-args: ${call}: ${this.pathOf(p)} takes arguments, so it cannot hold commands`)
    }
    if (toI32(this.cmdRequired[p].length) > 0) {
      panic(`cli-args: ${call}: ${this.pathOf(p)} has a required flag, so it cannot hold commands`)
    }
    // Marked before the lookup below, which the proof forgets the test across;
    // a panic after it leaves no tree to read.
    this.cmdGroup[p] = true
    const key = scopeKey(p, name)
    if (this.children.has(key)) {
      panic(`cli-args: ${call}: ${this.pathOf(p)} already has a command '${name}'`)
    }
    const handle: i32 = toI32(this.cmdName.length)
    this.children.set(key, handle)
    this.cmdName.push(name)
    this.cmdParent.push(p)
    this.cmdPath.push(path)
    this.cmdId.push(id)
    this.cmdDesc.push(description)
    this.cmdGroup.push(group)
    this.cmdAliases.push("")
    this.cmdEpilog.push("")
    this.cmdFirstArg.push(NONE)
    this.cmdLastArg.push(NONE)
    this.cmdVariadic.push(false)
    this.cmdOptionalArg.push(false)
    this.cmdRequired.push(new Array<i32>(0))
    return handle
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
    return this.addCommand(`group(${name})`, parent, name, NONE, description, true)
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
    const call = `command(${name})`
    if (id < 0) {
      panic(`cli-args: ${call}: the id ${id} is negative, which a group answers`)
    }
    const key = `${id}`
    const other = this.ids.get(key) ?? NONE
    if (other >= 0) {
      panic(`cli-args: ${call}: ${this.pathOf(other)} already has the id ${id}`)
    }
    const handle = this.addCommand(call, parent, name, id, description, false)
    this.ids.set(key, handle)
    return handle
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
    const call = `alias(${name})`
    const h = this.checkCommand(call, handle)
    if (h === ROOT) {
      panic(`cli-args: ${call}: the root has no alias`)
    }
    if (!isWord(name)) {
      panic(`cli-args: ${call}: '${name}' is not a command name`)
    }
    // Parallel arrays: never returns.
    if (!(h >= 0 && h < toI32(this.cmdParent.length) && h < toI32(this.cmdAliases.length))) {
      return
    }
    const parent: i32 = this.cmdParent[h]
    // Listed before the lookup below, which the proof forgets the test across;
    // a panic after it leaves no tree to read.
    this.cmdAliases[h] = this.cmdAliases[h].length > 0 ? `${this.cmdAliases[h]}, ${name}` : name
    const key = scopeKey(parent, name)
    if (this.children.has(key)) {
      panic(`cli-args: ${call}: ${this.pathOf(parent)} already has a command '${name}'`)
    }
    this.children.set(key, h)
    this.aliasOwner.push(h)
    this.aliasName.push(name)
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

  /** Whether flag `f` answers to `--name`, as itself or, negatable, as its negation. */
  private answersTo(f: i32, name: string): boolean {
    // Parallel arrays: always in range.
    return (
      f >= 0 &&
      f < toI32(this.flagLong.length) &&
      f < toI32(this.flagNegatable.length) &&
      (this.flagLong[f] === name || (this.flagNegatable[f] && `no-${this.flagLong[f]}` === name))
    )
  }

  /** A new flag in `scope` from `spec`; `call` names the declaration in a panic. */
  private addFlag(call: string, scope: i32, spec: string, description: string): i32 {
    const s = new FlagSpec(call, spec)
    if (s.long === "help" || s.long === "version" || s.short === "h" || s.short === "v") {
      panic(`cli-args: ${call}: -h, --help, -v and --version are taken`)
    }
    if (this.scopeHas(scope, s)) {
      const where = scope === GLOBAL ? "the global flags" : this.pathOf(scope)
      panic(`cli-args: ${call}: ${where} already has a flag of that name`)
    }
    if (scope === GLOBAL) {
      let clash = false
      let owner: i32 = NONE
      for (let f: i32 = 0; f < toI32(this.flagLong.length) && !clash; f++) {
        clash = this.answersTo(f, s.long) || (s.negated && this.answersTo(f, `no-${s.long}`))
        // Parallel arrays: `f` is always in range.
        if (f < toI32(this.flagShort.length) && f < toI32(this.flagOwner.length)) {
          clash = clash || (s.short.length > 0 && this.flagShort[f] === s.short)
          owner = this.flagOwner[f]
        }
      }
      if (clash) {
        panic(`cli-args: ${call}: ${this.pathOf(owner)} already has a flag of that name`)
      }
    } else if (this.scopeHas(GLOBAL, s)) {
      panic(`cli-args: ${call}: a global flag of that name is already declared`)
    }
    const handle: i32 = toI32(this.flagLong.length)
    this.flags.set(scopeKey(scope, `--${s.long}`), handle)
    if (s.negated) {
      this.negations.set(scopeKey(scope, `--no-${s.long}`), handle)
    }
    if (s.short.length > 0) {
      this.flags.set(scopeKey(scope, `-${s.short}`), handle)
    }
    this.flagOwner.push(scope)
    this.flagShort.push(s.short)
    this.flagLong.push(s.long)
    this.flagMeta.push(s.meta)
    this.flagValue.push(s.value)
    this.flagNegated.push(s.negated)
    this.flagNegatable.push(s.negated)
    this.flagDesc.push(description)
    this.flagDefault.push("")
    this.flagHasDefault.push(false)
    this.flagRequired.push(false)
    this.flagRepeatable.push(false)
    return handle
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
    return this.addFlag(`globalFlag("${spec}")`, GLOBAL, spec, description)
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
    const call = `flag("${spec}")`
    return this.addFlag(call, this.checkCommand(call, cmd), spec, description)
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
    const call = `defaultValue(${value})`
    const h = this.checkFlag(call, f)
    // Parallel arrays: never returns.
    if (
      !(
        h >= 0 &&
        h < toI32(this.flagValue.length) &&
        h < toI32(this.flagLong.length) &&
        h < toI32(this.flagRequired.length) &&
        h < toI32(this.flagDefault.length) &&
        h < toI32(this.flagHasDefault.length)
      )
    ) {
      return
    }
    if (this.flagValue[h] === VALUE_NONE) {
      panic(`cli-args: ${call}: --${this.flagLong[h]} takes no value`)
    }
    if (this.flagRequired[h]) {
      panic(`cli-args: ${call}: --${this.flagLong[h]} is required, so a default would never be read`)
    }
    this.flagDefault[h] = value
    this.flagHasDefault[h] = true
  }

  /**
   * Makes `f` an error to leave out, for the command that owns it (every
   * command, for a global); a group's flag cannot be, as no parse ends at one.
   *
   * @param f the handle of the flag; panics on a group's flag or one with a
   *   default. Calling it twice is the same as once
   */
  required(f: i32): void {
    const h = this.checkFlag("required", f)
    // Parallel arrays: never returns.
    if (
      !(
        h >= 0 &&
        h < toI32(this.flagOwner.length) &&
        h < toI32(this.flagLong.length) &&
        h < toI32(this.flagHasDefault.length) &&
        h < toI32(this.flagRequired.length)
      )
    ) {
      return
    }
    // `GLOBAL` or a command handle, which `flag` checked.
    const owner: i32 = this.flagOwner[h]
    if (owner >= 0 && owner < toI32(this.cmdGroup.length) && this.cmdGroup[owner]) {
      panic(
        `cli-args: required: ${this.pathOf(owner)} holds commands, so --${this.flagLong[h]} can never be checked`
      )
    }
    if (this.flagHasDefault[h]) {
      panic(`cli-args: required: --${this.flagLong[h]} has a default, so it can never be missing`)
    }
    if (!this.flagRequired[h]) {
      this.flagRequired[h] = true
      if (owner === GLOBAL) {
        this.globalRequired.push(h)
      } else if (owner >= 0 && owner < toI32(this.cmdRequired.length)) {
        this.cmdRequired[owner].push(h)
      }
    }
  }

  /**
   * Makes `f` gather every value it is given, in order, for
   * `ParseResult.values`.
   *
   * @param f the handle of a flag that takes a value; panics on one that
   *   takes none
   */
  repeatable(f: i32): void {
    const h = this.checkFlag("repeatable", f)
    // Parallel arrays: never returns.
    if (
      !(
        h >= 0 &&
        h < toI32(this.flagValue.length) &&
        h < toI32(this.flagLong.length) &&
        h < toI32(this.flagRepeatable.length)
      )
    ) {
      return
    }
    if (this.flagValue[h] === VALUE_NONE) {
      panic(`cli-args: repeatable: --${this.flagLong[h]} takes no value`)
    }
    this.flagRepeatable[h] = true
  }

  /**
   * Adds `--no-x` to the boolean flag `--x`, which turns it back off.
   *
   * @param f the handle of a flag declared `--x` with no value; panics on a
   *   flag that takes a value, one declared `--no-x`, or when `--no-x` is
   *   already a name a flag in its reach answers to
   */
  negatable(f: i32): void {
    const h = this.checkFlag("negatable", f)
    // Parallel arrays: never returns.
    if (
      !(
        h >= 0 &&
        h < toI32(this.flagLong.length) &&
        h < toI32(this.flagValue.length) &&
        h < toI32(this.flagNegated.length) &&
        h < toI32(this.flagOwner.length) &&
        h < toI32(this.flagNegatable.length)
      )
    ) {
      return
    }
    const call = `negatable(--${this.flagLong[h]})`
    if (this.flagValue[h] !== VALUE_NONE || this.flagNegated[h]) {
      panic(`cli-args: ${call}: only a boolean flag declared '--name' can be negated`)
    }
    const owner: i32 = this.flagOwner[h]
    const name = `no-${this.flagLong[h]}`
    let clash = this.taken(owner, `--${name}`) || (owner !== GLOBAL && this.taken(GLOBAL, `--${name}`))
    for (let g: i32 = 0; g < toI32(this.flagLong.length) && owner === GLOBAL && !clash; g++) {
      clash = this.answersTo(g, name)
    }
    if (clash) {
      panic(`cli-args: ${call}: --${name} is already declared`)
    }
    this.negations.set(scopeKey(owner, `--${name}`), h)
    // Marked last, or `answersTo` above would take `h` for a clash with
    // itself; tested again because the proof forgets the test across the
    // calls. Parallel arrays: always true.
    if (h >= 0 && h < toI32(this.flagNegatable.length)) {
      this.flagNegatable[h] = true
    }
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
    const call = `argument("${spec}")`
    const c = this.checkCommand(call, cmd)
    // Parallel arrays: never returns.
    if (!(c >= 0 && c < toI32(this.cmdGroup.length))) {
      return NONE
    }
    if (this.cmdGroup[c]) {
      panic(`cli-args: ${call}: ${this.pathOf(c)} holds commands, so it takes no arguments`)
    }
    const required = spec.startsWith("<") && spec.endsWith(">")
    if (!required && !(spec.startsWith("[") && spec.endsWith("]"))) {
      panic(`cli-args: ${call}: bad argument spec: an argument is written <name> or [name]`)
    }
    let name = spec.substring(1, spec.length - 1)
    const variadic = name.endsWith("...")
    if (variadic) {
      name = name.substring(0, name.length - 3)
    }
    if (!isWord(name)) {
      panic(`cli-args: ${call}: bad argument spec: the name is empty or has a space, '=' or leading dash`)
    }
    // Parallel arrays: never returns. Tested again here because the proof
    // forgets the test above across the string calls.
    if (
      !(
        c >= 0 &&
        c < toI32(this.cmdVariadic.length) &&
        c < toI32(this.cmdOptionalArg.length) &&
        c < toI32(this.cmdLastArg.length) &&
        c < toI32(this.cmdFirstArg.length)
      )
    ) {
      return NONE
    }
    if (this.cmdVariadic[c]) {
      panic(`cli-args: ${call}: no argument may follow a variadic one`)
    }
    if (required && this.cmdOptionalArg[c]) {
      panic(`cli-args: ${call}: a required argument may not follow an optional one`)
    }
    const handle: i32 = toI32(this.argName.length)
    const last: i32 = this.cmdLastArg[c]
    let index: i32 = 0
    // `argNext` and `argIndex` grow together; `last` is NONE or an argument.
    if (last >= 0 && last < toI32(this.argNext.length) && last < toI32(this.argIndex.length)) {
      this.argNext[last] = handle
      // An argument's index is below the argument count, an array length,
      // so one more cannot wrap.
      index = toI32(toU32(this.argIndex[last]) + 1)
    } else {
      this.cmdFirstArg[c] = handle
    }
    this.cmdLastArg[c] = handle
    this.cmdVariadic[c] = variadic
    this.cmdOptionalArg[c] = !required
    this.argOwner.push(c)
    this.argName.push(name)
    this.argRequired.push(required)
    this.argVariadic.push(variadic)
    this.argDesc.push(description)
    this.argIndex.push(index)
    this.argNext.push(NONE)
    return handle
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
    const h = this.checkCommand("epilog", handle)
    // Parallel arrays: always true.
    if (h >= 0 && h < toI32(this.cmdEpilog.length)) {
      this.cmdEpilog[h] = text
    }
  }

  /**
   * The flag `name` (dashes included) names in `table` at `cmd`: its own, then
   * a global; -1 for none. `table` is `flags`, or `negations` for `--no-x`.
   */
  private lookup(table: Map<string, i32>, cmd: i32, name: string): i32 {
    const own = table.get(scopeKey(cmd, name)) ?? -1
    return own >= 0 ? own : (table.get(scopeKey(GLOBAL, name)) ?? -1)
  }

  /** @internal Called by `ParseResult`. How `f` is spelled on the command line: its long name, or `--no-x` for one declared that way. */
  spelling(f: i32): string {
    const h = this.checkFlag("spelling", f)
    // Parallel arrays: never returns.
    if (!(h >= 0 && h < toI32(this.flagNegated.length) && h < toI32(this.flagLong.length))) {
      return ""
    }
    return this.flagNegated[h] ? `--no-${this.flagLong[h]}` : `--${this.flagLong[h]}`
  }

  /** Every long flag `cmd` answers to, for a did-you-mean. */
  private longNames(cmd: i32): string[] {
    const names: string[] = []
    for (
      let f: i32 = 0;
      f < toI32(this.flagLong.length) &&
      f < toI32(this.flagOwner.length) &&
      f < toI32(this.flagNegatable.length);
      f++
    ) {
      if (this.flagOwner[f] === cmd || this.flagOwner[f] === GLOBAL) {
        // Read before the pushes, which the proof forgets the bounds across.
        const long = this.flagLong[f]
        const negatable = this.flagNegatable[f]
        names.push(`--${long}`)
        if (negatable) {
          names.push(`--no-${long}`)
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
    for (let c: i32 = 0; c < toI32(this.cmdName.length) && c < toI32(this.cmdParent.length); c++) {
      if (this.cmdParent[c] === cmd) {
        names.push(this.cmdName[c])
      }
    }
    for (
      let i: i32 = 0;
      withAliases && i < toI32(this.aliasName.length) && i < toI32(this.aliasOwner.length);
      i++
    ) {
      const owner: i32 = this.aliasOwner[i]
      if (owner >= 0 && owner < toI32(this.cmdParent.length) && this.cmdParent[owner] === cmd) {
        names.push(this.aliasName[i])
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
      } else if (this.isGroupAt(r.command) && !r.badCommand) {
        const child = this.children.get(scopeKey(r.command, token)) ?? -1
        if (child >= 0) {
          r.command = child
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

  /** Whether `cmd`, `ROOT` or a handle from `children` and so in range, holds commands. */
  private isGroupAt(cmd: i32): boolean {
    return cmd >= 0 && cmd < toI32(this.cmdGroup.length) && this.cmdGroup[cmd]
  }

  /** Records `token` as no command `r`'s group holds, with the nearest one that it does. */
  private unknownCommand(r: ParseResult, token: string): void {
    const near = closest(token, this.childNames(r.command, true))
    r.badCommand = true
    r.fail(
      r.command,
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
    // A handle from `flags` indexes every flag array, so the bound holds.
    if (f >= 0 && f < toI32(this.flagValue.length)) {
      if (eq >= 0) {
        if (this.flagValue[f] === VALUE_NONE) {
          r.fail(r.command, `${name} takes no value`)
        } else {
          // `eq` is an index into `token`, so one more cannot wrap.
          r.set(f, token.substring(toI32(toU32(eq) + 1), token.length))
        }
        return next
      }
      return this.takeValue(r, argv, next, f, "")
    }
    const off = this.lookup(this.negations, r.command, name)
    if (off >= 0) {
      if (eq >= 0) {
        r.fail(r.command, `${name} takes no value`)
      } else {
        r.set(off, "false")
      }
      return next
    }
    const near = closest(name, this.longNames(r.command))
    r.fail(
      r.command,
      near.length > 0 ? `unknown flag ${name} (did you mean ${near}?)` : `unknown flag ${name}`
    )
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
        if (f < 0) {
          r.fail(r.command, `unknown flag -${letter}`)
          return next
        }
        // A handle from `flags` indexes every flag array: never returns.
        if (!(f < toI32(this.flagValue.length) && f < toI32(this.flagNegated.length))) {
          return next
        }
        const kind: i32 = this.flagValue[f]
        const negated = this.flagNegated[f]
        const attached = token.substring(k + 1, token.length)
        if (kind !== VALUE_NONE) {
          if (attached.startsWith("=")) {
            r.set(f, attached.substring(1, attached.length))
            return next
          }
          return this.takeValue(r, argv, next, f, attached)
        }
        if (attached.startsWith("=")) {
          r.fail(r.command, `-${letter} takes no value`)
          return next
        }
        r.set(f, negated ? "false" : "true")
      }
    }
    return next
  }

  /**
   * Records flag `f` as given, with `attached` (from `-l5`) as its value when
   * not empty, or else the token at `next` when the flag's value takes it;
   * answers the index after whatever it took.
   */
  private takeValue(r: ParseResult, argv: string[], next: i32, f: i32, attached: string): i32 {
    // The callers pass a handle from `flags`, which indexes every flag
    // array: never returns.
    if (!(f >= 0 && f < toI32(this.flagValue.length) && f < toI32(this.flagLong.length))) {
      return next
    }
    const kind: i32 = this.flagValue[f]
    const long = this.flagLong[f]
    if (kind === VALUE_NONE) {
      r.set(f, "true")
      return next
    }
    if (attached.length > 0) {
      r.set(f, attached)
      return next
    }
    if (kind === VALUE_REQUIRED) {
      if (!(next >= 0 && next < toI32(argv.length))) {
        r.fail(r.command, `--${long} needs a value`)
        return next
      }
      r.set(f, argv[next])
      return next + 1
    }
    if (next >= 0 && next < toI32(argv.length)) {
      const word = argv[next]
      if (!(word.length > 0 && toI32(word.charCodeAt(0)) === DASH)) {
        r.set(f, word)
        // `next` is below `argv.length`, so one more cannot wrap.
        return toI32(toU32(next) + 1)
      }
    }
    r.set(f, "")
    return next
  }

  /** A help row's flag column for `f`: `-s, --long`, with `--[no-]x` for a negatable one. */
  private flagLabel(f: i32): string {
    // `flagRows` passes a flag handle, which indexes every flag array: never
    // returns.
    if (
      !(
        f >= 0 &&
        f < toI32(this.flagNegatable.length) &&
        f < toI32(this.flagLong.length) &&
        f < toI32(this.flagShort.length)
      )
    ) {
      return ""
    }
    const short = this.flagShort[f]
    const long = this.flagNegatable[f] ? `--[no-]${this.flagLong[f]}` : this.spelling(f)
    return short.length > 0 ? `-${short}, ${long}` : long
  }

  /** A help row's description for `f`, with what it is: repeatable, its default, required. */
  private flagText(f: i32): string {
    // `flagRows` passes a flag handle, which indexes every flag array: never
    // returns.
    if (
      !(
        f >= 0 &&
        f < toI32(this.flagDesc.length) &&
        f < toI32(this.flagRepeatable.length) &&
        f < toI32(this.flagHasDefault.length) &&
        f < toI32(this.flagDefault.length) &&
        f < toI32(this.flagRequired.length)
      )
    ) {
      return ""
    }
    const repeatable = this.flagRepeatable[f]
    const hasDefault = this.flagHasDefault[f]
    const value = this.flagDefault[f]
    const required = this.flagRequired[f]
    let text = this.flagDesc[f]
    if (repeatable) {
      text = `${text} (repeatable)`
    }
    if (hasDefault) {
      text = `${text} (default: ${value})`
    }
    if (required) {
      text = `${text} (required)`
    }
    return text
  }

  /** Adds a `section` row to `rows` for every flag `owner` (a command, or `GLOBAL`) declares. */
  private flagRows(rows: HelpRow[], section: string, owner: i32): void {
    for (
      let f: i32 = 0;
      f < toI32(this.flagLong.length) && f < toI32(this.flagOwner.length) && f < toI32(this.flagMeta.length);
      f++
    ) {
      if (this.flagOwner[f] === owner) {
        const meta = this.flagMeta[f]
        rows.push(new HelpRow(section, this.flagLabel(f), meta, this.flagText(f)))
      }
    }
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
    const cmd = this.checkCommand("help", handle)
    const rows: HelpRow[] = []
    const shape: string[] = []
    const path = this.pathOf(cmd)
    const program = this.name.length
    if (path.length > program) {
      shape.push(path.substring(program + 1, path.length))
    }
    // `checkCommand` answered a command handle, which indexes every command
    // array: never returns.
    if (
      !(
        cmd >= 0 &&
        cmd < toI32(this.cmdGroup.length) &&
        cmd < toI32(this.cmdFirstArg.length) &&
        cmd < toI32(this.cmdDesc.length) &&
        cmd < toI32(this.cmdEpilog.length)
      )
    ) {
      return ""
    }
    const description = this.cmdDesc[cmd]
    const epilog = this.cmdEpilog[cmd]
    let a: i32 = this.cmdFirstArg[cmd]
    if (this.cmdGroup[cmd]) {
      shape.push("<command>")
      for (
        let c: i32 = 0;
        c < toI32(this.cmdName.length) &&
        c < toI32(this.cmdParent.length) &&
        c < toI32(this.cmdAliases.length) &&
        c < toI32(this.cmdDesc.length);
        c++
      ) {
        if (this.cmdParent[c] === cmd) {
          const aliases = this.cmdAliases[c]
          const label = aliases.length > 0 ? `${this.cmdName[c]}, ${aliases}` : this.cmdName[c]
          rows.push(new HelpRow("Commands", label, "", this.cmdDesc[c]))
        }
      }
    }
    while (
      a >= 0 &&
      a < toI32(this.argName.length) &&
      a < toI32(this.argVariadic.length) &&
      a < toI32(this.argRequired.length) &&
      a < toI32(this.argDesc.length) &&
      a < toI32(this.argNext.length)
    ) {
      const after = this.argNext[a]
      const desc = this.argDesc[a]
      const dots = this.argVariadic[a] ? "..." : ""
      const label = this.argRequired[a] ? `<${this.argName[a]}${dots}>` : `[${this.argName[a]}${dots}]`
      shape.push(label)
      rows.push(new HelpRow("Arguments", label, "", desc))
      a = after
    }
    shape.push("[flags]")
    this.flagRows(rows, "Flags", cmd)
    rows.push(new HelpRow("Flags", "-h, --help", "", "show help"))
    if (cmd === ROOT) {
      rows.push(new HelpRow("Flags", "-v, --version", "", "show the version"))
    }
    this.flagRows(rows, "Global flags", GLOBAL)
    // Widths sum in i64, where a few i32 terms cannot wrap.
    let widest: i64 = toI64(0)
    for (let i: i32 = 0; i < toI32(rows.length); i++) {
      const row = rows[i]
      let width: i64 = toI64(2) + toI64(toI32(row.label.length))
      if (row.meta.length > 0) {
        width = toI64(2) + toI64(toI32(row.label.length)) + toI64(1) + toI64(toI32(row.meta.length))
      }
      widest = width > widest ? width : widest
    }
    // `widest` is below `MAX_COLUMN - 2` where it is widened, so the u32 add
    // cannot wrap.
    const column: i32 = widest < toI64(MAX_COLUMN - 2) ? toI32(toU32(widest) + 2) : MAX_COLUMN
    const usage = shape.join(" ")
    // Two i32 lengths and two constants fit an i64; the help line is far
    // shorter than 2^31 bytes, so the narrowing keeps the sum.
    const usageColumn: i32 = toI32(
      toI64(8) + toI64(toI32(this.name.length)) + toI64(toI32(usage.length)) + toI64(3)
    )
    const menu = new HelpMenu(style, this.name, column, usageColumn)
    menu.header(this.version, this.description)
    menu.usage(usage, cmd === ROOT ? "" : description)
    let open = ""
    for (let i: i32 = 0; i < toI32(rows.length); i++) {
      const row = rows[i]
      if (row.section !== open) {
        open = row.section
        menu.section(open)
      }
      menu.row(row.label, row.meta, row.text)
    }
    if (epilog.length > 0) {
      menu.line("")
      menu.line(epilog)
    }
    return menu.text()
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

/**
 * What `Cli.parse` found: the command the arguments name and every value
 * they set, or that they ask for help or the version, or what is wrong with
 * them. Values are read by the handles the tree was declared with.
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
  private setFlags: i32[]
  private setValues: string[]
  /** @internal Used by `Cli`. */
  positionalValues: string[]
  /** @internal Used by `Cli`. */
  restValues: string[]
  /** `PARSE_OK`, `PARSE_HELP`, `PARSE_VERSION` or `PARSE_ERROR`. */
  kind: i32
  /** The handle of the deepest command the arguments reached. */
  command: i32
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
    this.id = -1
    this.path = ""
    this.message = ""
    this.hint = ""
    this.exitCode = 0
    this.errorPath = ""
    this.wantHelp = false
    this.helpWord = false
    this.badCommand = false
    this.wantVersion = false
    this.setFlags = []
    this.setValues = []

    this.positionalValues = []
    this.restValues = []
  }

  /** @internal Called by `Cli`. Records `text` as the error found at `cmd`, unless one is already recorded: the first wins. */
  fail(cmd: i32, text: string): void {
    if (this.message.length === 0) {
      this.errorPath = this.cli.pathOf(cmd)
      this.message = `${this.errorPath}: ${text}`
      this.hint = usageHint(`${this.errorPath} --help`)
    }
  }

  /** @internal Called by `Cli`. Records flag `f` as given `value`. */
  set(f: i32, value: string): void {
    this.setFlags.push(f)
    this.setValues.push(value)
  }

  /**
   * @internal Called by `Cli`.
   * Settles the kind once the walk is over: help (unless `help <path>` named
   * no command), then the version, then an error, then the checks only a
   * whole command line can fail.
   */
  finishWalk(): void {
    const cli = this.cli
    const cmd = this.command
    // `command` is `ROOT` or a handle from `children`, which indexes every
    // command array: never returns.
    if (
      !(
        cmd >= 0 &&
        cmd < toI32(cli.cmdId.length) &&
        cmd < toI32(cli.cmdGroup.length) &&
        cmd < toI32(cli.cmdRequired.length) &&
        cmd < toI32(cli.cmdFirstArg.length)
      )
    ) {
      return
    }
    const group = cli.cmdGroup[cmd]
    const required = cli.cmdRequired[cmd]
    let a: i32 = cli.cmdFirstArg[cmd]
    this.id = cli.cmdId[cmd]
    this.path = cli.pathOf(cmd)
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
    if (group) {
      this.fail(cmd, `missing command (one of: ${cli.childNames(cmd, false).join(", ")})`)
    }
    let missing: i32 = this.firstMissing(required)
    if (missing < 0) {
      missing = this.firstMissing(cli.globalRequired)
    }
    if (missing >= 0) {
      this.fail(cmd, `missing required flag ${cli.spelling(missing)}`)
    }
    let last: i32 = -1
    while (
      a >= 0 &&
      a < toI32(cli.argName.length) &&
      a < toI32(cli.argRequired.length) &&
      a < toI32(cli.argIndex.length) &&
      a < toI32(cli.argVariadic.length) &&
      a < toI32(cli.argNext.length) &&
      this.message.length === 0
    ) {
      const after = cli.argNext[a]
      if (cli.argRequired[a] && cli.argIndex[a] >= toI32(this.positionalValues.length)) {
        const dots = cli.argVariadic[a] ? "..." : ""
        this.fail(cmd, `missing argument <${cli.argName[a]}${dots}>`)
      }
      last = a
      a = after
    }
    let taken: i32 = 0
    // `last` is NONE or an argument the loop read, so in range.
    if (last >= 0 && last < toI32(cli.argVariadic.length) && last < toI32(cli.argIndex.length)) {
      // An argument's index is below the argument count, an array length,
      // so one more cannot wrap.
      taken = cli.argVariadic[last] ? toI32(this.positionalValues.length) : toI32(toU32(cli.argIndex[last]) + 1)
    }
    if (this.message.length === 0 && taken < toI32(this.positionalValues.length) && taken >= 0) {
      this.fail(cmd, `unexpected argument '${this.positionalValues[taken]}'`)
    }
    if (this.message.length > 0) {
      this.kind = PARSE_ERROR
      this.exitCode = 2
    }
  }

  /** The first of the `required` flags the arguments did not set, else -1. */
  private firstMissing(required: i32[]): i32 {
    for (let i: i32 = 0; i < toI32(required.length); i++) {
      if (this.lastSet(required[i]) < 0) {
        return required[i]
      }
    }
    return -1
  }

  /**
   * Where the last value of flag `f` is in `setValues`, or -1 when it was not
   * given: a scan of the flags the arguments set, so bounded by their count.
   */
  private lastSet(f: i32): i32 {
    for (let i: i32 = toI32(this.setFlags.length) - 1; i >= 0 && i < toI32(this.setFlags.length); i--) {
      if (this.setFlags[i] === f) {
        return i
      }
    }
    return NONE
  }

  /**
   * Whether flag `f` is on: a boolean's value (true by default for one
   * declared `--no-x`), or for a flag with a value, whether it was given.
   *
   * @param f the handle of a flag anywhere in the tree; panics on a handle
   *   no declaration answered
   * @returns the last of the arguments' settings for a boolean, so
   *   `--x --no-x` is off
   */
  flag(f: i32): boolean {
    const h = this.cli.checkFlag("flag", f)
    // `checkFlag` answered a flag handle, which indexes every flag array:
    // never returns.
    if (!(h >= 0 && h < toI32(this.cli.flagValue.length) && h < toI32(this.cli.flagNegated.length))) {
      return false
    }
    const kind: i32 = this.cli.flagValue[h]
    const negated = this.cli.flagNegated[h]
    const at = this.lastSet(h)
    if (kind !== VALUE_NONE) {
      return at >= 0
    }
    if (at >= 0 && at < toI32(this.setValues.length)) {
      return this.setValues[at] === "true"
    }
    return negated
  }

  /**
   * The value of flag `f`: the last one given (empty for `[value]` given
   * none), else its default, else null.
   *
   * @param f the handle of a flag anywhere in the tree; panics on a handle
   *   no declaration answered
   * @returns the value as written, or `"true"` or `"false"` for a boolean
   *   that was given; null tells a flag never given and with no default
   */
  value(f: i32): string | null {
    const h = this.cli.checkFlag("value", f)
    // `checkFlag` answered a flag handle, which indexes every flag array:
    // never returns.
    if (!(h >= 0 && h < toI32(this.cli.flagHasDefault.length) && h < toI32(this.cli.flagDefault.length))) {
      return null
    }
    const fallback: string | null = this.cli.flagHasDefault[h] ? this.cli.flagDefault[h] : null
    const at = this.lastSet(h)
    if (at >= 0 && at < toI32(this.setValues.length)) {
      return this.setValues[at]
    }
    return fallback
  }

  /**
   * Every value of flag `f` in order for a repeatable one, the last alone
   * for any other, else its default alone, else none.
   *
   * @param f the handle of a flag anywhere in the tree; panics on a handle
   *   no declaration answered
   * @returns a fresh array the caller owns
   */
  values(f: i32): string[] {
    const h = this.cli.checkFlag("values", f)
    const out: string[] = []
    // `checkFlag` answered a flag handle, which indexes every flag array:
    // never returns.
    if (
      !(
        h >= 0 &&
        h < toI32(this.cli.flagRepeatable.length) &&
        h < toI32(this.cli.flagHasDefault.length) &&
        h < toI32(this.cli.flagDefault.length)
      )
    ) {
      return out
    }
    const hasDefault = this.cli.flagHasDefault[h]
    const fallback = this.cli.flagDefault[h]
    if (this.cli.flagRepeatable[h]) {
      for (let i: i32 = 0; i < toI32(this.setFlags.length) && i < toI32(this.setValues.length); i++) {
        if (this.setFlags[i] === h) {
          out.push(this.setValues[i])
        }
      }
    } else {
      const at = this.lastSet(h)
      if (at >= 0 && at < toI32(this.setValues.length)) {
        out.push(this.setValues[at])
      }
    }
    if (out.length === 0 && hasDefault) {
      out.push(fallback)
    }
    return out
  }

  /**
   * Where flag `f`'s value came from: `SOURCE_ARGV`, `SOURCE_DEFAULT` or
   * `SOURCE_UNSET`.
   *
   * @param f the handle of a flag anywhere in the tree; panics on a handle
   *   no declaration answered
   * @returns `SOURCE_ARGV` when the arguments gave it, `SOURCE_DEFAULT` when
   *   it has a default or is declared `--no-x` (on by default), else
   *   `SOURCE_UNSET`
   */
  source(f: i32): i32 {
    const h = this.cli.checkFlag("source", f)
    // `checkFlag` answered a flag handle, which indexes every flag array:
    // never returns.
    if (!(h >= 0 && h < toI32(this.cli.flagHasDefault.length) && h < toI32(this.cli.flagNegated.length))) {
      return SOURCE_UNSET
    }
    const fallback = this.cli.flagHasDefault[h] || this.cli.flagNegated[h]
    if (this.lastSet(h) >= 0) {
      return SOURCE_ARGV
    }
    return fallback ? SOURCE_DEFAULT : SOURCE_UNSET
  }

  /**
   * The argument `a`'s value, or null when it was not given or belongs to
   * another command.
   *
   * @param a the handle of an argument; panics on a handle no `argument`
   *   call answered
   * @returns the word at the argument's place among the positionals, which
   *   for a variadic one is the first it took
   */
  positional(a: i32): string | null {
    const h = this.cli.checkArgument("positional", a)
    // `checkArgument` answered an argument handle, which indexes every
    // argument array: never returns.
    if (!(h >= 0 && h < toI32(this.cli.argIndex.length) && h < toI32(this.cli.argOwner.length))) {
      return null
    }
    const k: i32 = this.cli.argIndex[h]
    if (this.cli.argOwner[h] !== this.command || !(k >= 0 && k < toI32(this.positionalValues.length))) {
      return null
    }
    return this.positionalValues[k]
  }

  /**
   * Every value from argument `a` on: all a variadic one took, or the one
   * value of any other.
   *
   * @param a the handle of an argument; panics on a handle no `argument`
   *   call answered
   * @returns a fresh array the caller owns; empty when the argument was not
   *   given or belongs to another command
   */
  positionals(a: i32): string[] {
    const h = this.cli.checkArgument("positionals", a)
    const out: string[] = []
    // `checkArgument` answered an argument handle, which indexes every
    // argument array: never returns.
    if (
      !(
        h >= 0 &&
        h < toI32(this.cli.argOwner.length) &&
        h < toI32(this.cli.argIndex.length) &&
        h < toI32(this.cli.argVariadic.length)
      )
    ) {
      return out
    }
    if (this.cli.argOwner[h] !== this.command) {
      return out
    }
    const k: i32 = this.cli.argIndex[h]
    // An argument's index is below the argument count, an array length, so
    // one more cannot wrap.
    const end: i32 = this.cli.argVariadic[h] ? toI32(this.positionalValues.length) : toI32(toU32(k) + 1)
    for (let i: i32 = k; i < end && i >= 0 && i < toI32(this.positionalValues.length); i++) {
      out.push(this.positionalValues[i])
    }
    return out
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
    return this.cli.helpText(this.command, style)
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
