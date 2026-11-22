// The checked twins of every `Cli` declaration, the `ParseResult` readers that
// take a `CliFlag` or `CliArgument`, and the did-you-mean's edit distance at
// its edges. Each twin is called once to succeed and then on each mistake it
// refuses, printing the `Err` text the panicking original would panic with.
import { Cli, CliArgument, CliFlag, PARSE_ERROR, PARSE_OK, ROOT, SOURCE_ARGV, SOURCE_DEFAULT, SOURCE_UNSET } from "nish/cli-args"

/** Prints what an `i32`-answering twin gave: its handle's sign, or its error. */
const showHandle = (label: string, r: Result<i32, string>): void => {
  if (r.isErr()) {
    console.log(`${label}: ${r.error}`)
    return
  }
  console.log(`${label}: ok`)
}

/** Prints what a `void`-answering twin gave. */
const showVoid = (label: string, r: Result<void, string>): void => {
  if (r.isErr()) {
    console.log(`${label}: ${r.error}`)
    return
  }
  console.log(`${label}: ok`)
}

/** Prints what a flag twin gave. */
const showFlag = (label: string, r: Result<CliFlag, string>): void => {
  if (r.isErr()) {
    console.log(`${label}: ${r.error}`)
    return
  }
  console.log(`${label}: ok`)
}

/** Prints what an argument twin gave. */
const showArgument = (label: string, r: Result<CliArgument, string>): void => {
  if (r.isErr()) {
    console.log(`${label}: ${r.error}`)
    return
  }
  console.log(`${label}: ok`)
}

/** Declares the errors of every twin on a tree of its own. */
const refusals = (): void => {
  const cli = new Cli("api", "1.4.0", "Talk to the Example API")
  const users = cli.group(ROOT, "users", "Manage users")
  const list = cli.command(users, "list", 1, "List users")
  const get = cli.command(users, "get", 2, "Show one user")
  cli.argument(get, "<user-id>", "the user")
  const create = cli.command(users, "create", 3, "Create a user")
  const name = cli.flag(create, "--name <name>", "the name")
  cli.required(name)
  const limit = cli.flag(list, "--limit <n>", "at most n")
  const all = cli.flag(list, "--all", "everything")
  const color = cli.globalFlag("--color", "paint the output")

  showHandle("tryGroup bad handle", cli.tryGroup(99, "x", ""))
  showHandle("tryGroup bad name", cli.tryGroup(ROOT, "-x", ""))
  showHandle("tryGroup under a command", cli.tryGroup(list, "x", ""))
  showHandle("tryGroup taken", cli.tryGroup(ROOT, "users", ""))
  showHandle("tryGroup", cli.tryGroup(ROOT, "projects", ""))
  // Only the root is both a group and a command that may take arguments and
  // required flags: each closes it to commands.
  const withArgs = new Cli("cat", "1.0.0", "")
  showArgument("tryArgument on the root", withArgs.tryArgument(ROOT, "<file>", ""))
  showHandle("tryGroup under arguments", withArgs.tryGroup(ROOT, "x", ""))
  const withRequired = new Cli("cat", "1.0.0", "")
  const output = withRequired.flag(ROOT, "--output <file>", "")
  showVoid("tryRequired on the root", withRequired.tryRequired(output))
  showHandle("tryCommand under a required flag", withRequired.tryCommand(ROOT, "x", 1, ""))

  showHandle("tryCommand negative id", cli.tryCommand(users, "x", -1, ""))
  showHandle("tryCommand id taken", cli.tryCommand(users, "x", 1, ""))
  showHandle("tryCommand bad handle", cli.tryCommand(-3, "x", 9, ""))
  showHandle("tryCommand taken", cli.tryCommand(users, "list", 9, ""))
  showHandle("tryCommand", cli.tryCommand(users, "delete", 9, ""))

  showVoid("tryAlias bad handle", cli.tryAlias(99, "x"))
  showVoid("tryAlias root", cli.tryAlias(ROOT, "x"))
  showVoid("tryAlias bad name", cli.tryAlias(list, "a b"))
  showVoid("tryAlias taken", cli.tryAlias(list, "get"))
  showVoid("tryAlias", cli.tryAlias(list, "ls"))
  showVoid("tryAlias taken by an alias", cli.tryAlias(get, "ls"))

  showFlag("tryGlobalFlag bad spec", cli.tryGlobalFlag("-xy, --x", ""))
  showFlag("tryGlobalFlag short not a letter", cli.tryGlobalFlag("-=, --x", ""))
  showFlag("tryGlobalFlag no dashes", cli.tryGlobalFlag("x", ""))
  showFlag("tryGlobalFlag bad name", cli.tryGlobalFlag("--", ""))
  showFlag("tryGlobalFlag bad value", cli.tryGlobalFlag("--x <y", ""))
  showFlag("tryGlobalFlag help", cli.tryGlobalFlag("--help", ""))
  showFlag("tryGlobalFlag taken", cli.tryGlobalFlag("--color", ""))
  showFlag("tryGlobalFlag taken by a local", cli.tryGlobalFlag("--limit <n>", ""))
  showFlag("tryGlobalFlag", cli.tryGlobalFlag("--verbose", ""))

  showFlag("tryFlag bad handle", cli.tryFlag(99, "--x", ""))
  showFlag("tryFlag taken here", cli.tryFlag(list, "--limit <n>", ""))
  showFlag("tryFlag taken by a global", cli.tryFlag(list, "--color", ""))
  showFlag("tryFlag", cli.tryFlag(get, "--limit <n>", ""))

  showVoid("tryDefaultValue bad handle", cli.tryDefaultValue(99, "x"))
  showVoid("tryDefaultValue boolean", cli.tryDefaultValue(all, "x"))
  showVoid("tryDefaultValue required", cli.tryDefaultValue(name, "x"))
  showVoid("tryDefaultValue", cli.tryDefaultValue(limit, "10"))

  showVoid("tryRequired bad handle", cli.tryRequired(-1))
  const usersFlag = cli.flag(users, "--page <n>", "")
  showVoid("tryRequired on a group", cli.tryRequired(usersFlag))
  showVoid("tryRequired defaulted", cli.tryRequired(limit))
  showVoid("tryRequired", cli.tryRequired(all))

  showVoid("tryRepeatable bad handle", cli.tryRepeatable(99))
  showVoid("tryRepeatable boolean", cli.tryRepeatable(color))
  showVoid("tryRepeatable", cli.tryRepeatable(limit))

  showVoid("tryNegatable bad handle", cli.tryNegatable(99))
  showVoid("tryNegatable value flag", cli.tryNegatable(limit))
  const noTrace = cli.globalFlag("--no-trace", "")
  showVoid("tryNegatable negation", cli.tryNegatable(noTrace))
  showVoid("tryNegatable", cli.tryNegatable(color))
  showVoid("tryNegatable twice", cli.tryNegatable(color))
  // A value flag may be named `--no-dry`; it is not a negation, so `--dry`
  // may be declared beside it but not made negatable.
  cli.flag(list, "--no-dry <how>", "")
  const dry = cli.globalFlag("--dry", "")
  showVoid("tryNegatable taken", cli.tryNegatable(dry))

  showArgument("tryArgument bad handle", cli.tryArgument(99, "<x>", ""))
  showArgument("tryArgument group", cli.tryArgument(users, "<x>", ""))
  showArgument("tryArgument bad spec", cli.tryArgument(get, "x", ""))
  showArgument("tryArgument bad name", cli.tryArgument(get, "<a b>", ""))
  showArgument("tryArgument optional", cli.tryArgument(get, "[note]", ""))
  showArgument("tryArgument required after optional", cli.tryArgument(get, "<more>", ""))
  showArgument("tryArgument variadic", cli.tryArgument(get, "[rest...]", ""))
  showArgument("tryArgument after variadic", cli.tryArgument(get, "[last]", ""))

  showVoid("tryEpilog bad handle", cli.tryEpilog(99, "x"))
  showVoid("tryEpilog", cli.tryEpilog(list, "Lists are paged."))
}

/** The readers on one parse of a small tree. */
const readers = (): void => {
  const cli = new Cli("api", "1.4.0", "")
  const keys = cli.tryCommand(ROOT, "keys", 1, "").expect("declares")
  const user = cli.tryArgument(keys, "<user>", "").expect("declares")
  const scopes = cli.tryArgument(keys, "[scope...]", "").expect("declares")
  const tag = cli.tryFlag(keys, "-t, --tag <tag>", "").expect("declares")
  cli.tryRepeatable(tag.handle).expect("declares")
  const base = cli.tryGlobalFlag("--base <url>", "").expect("declares")
  cli.tryDefaultValue(base.handle, "https://x").expect("declares")
  const raw = cli.tryGlobalFlag("-r, --raw", "").expect("declares")
  const color = cli.tryGlobalFlag("--color", "").expect("declares")
  cli.tryNegatable(color.handle).expect("declares")
  const limit = cli.tryFlag(keys, "--limit <n>", "").expect("declares")

  const argv: string[] = ["api", "keys", "42", "read", "write", "-t", "a", "--tag=b", "-r", "--no-color"]
  const r = cli.parse(argv, 1)
  console.log(`status ok: ${r.kind === PARSE_OK}`)
  console.log(`user: ${r.readPositional(user) ?? "(none)"}`)
  console.log(`scopes: ${r.readPositionals(scopes).join(",")}`)
  console.log(`tags: ${r.readValues(tag).join(",")} from argv: ${r.readSource(tag) === SOURCE_ARGV}`)
  console.log(`tag: ${r.readValue(tag) ?? "(none)"}`)
  console.log(`base: ${r.readValue(base) ?? "(none)"} default: ${r.readSource(base) === SOURCE_DEFAULT}`)
  console.log(`raw: ${r.readFlag(raw)} color: ${r.readFlag(color)}`)
  console.log(`limit: ${r.readValue(limit) ?? "(none)"} unset: ${r.readSource(limit) === SOURCE_UNSET}`)
  console.log(`limit values: ${r.readValues(limit).length}`)
}

/** The did-you-mean at the edges of the edit distance. */
const suggestions = (): void => {
  const cli = new Cli("api", "1.4.0", "")
  const users = cli.tryGroup(ROOT, "users", "").expect("declares")
  // A long name first, so the table the short one reuses was grown for it.
  cli.tryCommand(users, "administrators", 1, "").expect("declares")
  cli.tryCommand(users, "keys", 2, "").expect("declares")
  cli.tryCommand(users, "ab", 3, "").expect("declares")
  const words: string[] = ["kyes", "ksey", "", "-", "--", "administratosr", "x", "zzzzzz"]
  for (const word of words) {
    const r = cli.parse(["api", "users", word], 1)
    console.log(`'${word}': ${r.kind === PARSE_ERROR ? r.message : "parsed"}`)
  }
  const flags: string[] = ["--lmit", "---", "--"]
  const keys = cli.tryCommand(ROOT, "keys", 4, "").expect("declares")
  cli.tryFlag(keys, "--limit <n>", "").expect("declares")
  for (const flag of flags) {
    const r = cli.parse(["api", "keys", flag], 1)
    console.log(`'${flag}': ${r.kind === PARSE_ERROR ? r.message : "parsed"}`)
  }
}

export const main = (): i32 => {
  refusals()
  readers()
  suggestions()
  return 0
}
