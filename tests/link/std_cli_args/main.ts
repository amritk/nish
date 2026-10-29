// `nish/cli-args` on one tree of three levels: every flag form with its value
// and source, a global flag at every depth, every error with its wording, help
// and version, the help pages as plain text, and a tree of 500 commands parsed
// ten thousand times. Nothing here exits; `std_cli_args_exit` runs `finish`.
import {
  Cli,
  PARSE_ERROR,
  PARSE_HELP,
  PARSE_OK,
  PARSE_VERSION,
  ParseResult,
  ROOT,
  SOURCE_ARGV,
  SOURCE_DEFAULT,
  SOURCE_UNSET,
} from "nish/cli-args"
import { Style } from "nish/cli"
import { Suite } from "nish/testing"
import { splitLines } from "nish/text"
import { monotonicNanos } from "nish:process"

const USERS_LIST: i32 = 1
const USERS_GET: i32 = 2
const KEYS_LIST: i32 = 3
const KEYS_CREATE: i32 = 4
const PROJECTS_LIST: i32 = 5
const PROJECTS_TAG: i32 = 6

// Module constants are numbers, booleans or strings, so the tree and its
// handles live in an object `build` makes.
class Api {
  cli: Cli
  users: i32
  keys: i32
  keysList: i32
  keysCreate: i32
  base: i32
  token: i32
  raw: i32
  color: i32
  limit: i32
  tag: i32
  verbose: i32
  all: i32
  format: i32
  name: i32
  userId: i32
  scopes: i32
  dryRun: i32
  projectsAll: i32
  tagged: i32

  constructor() {
    const cli = new Cli("api", "1.4.0", "Talk to the Example API")
    this.cli = cli
    this.base = cli.globalFlag("--base-url <url>", "API base URL")
    cli.defaultValue(this.base, "https://api.example.com")
    this.token = cli.globalFlag("--token <token>", "the API token")
    this.raw = cli.globalFlag("-r, --raw-output", "print JSON as it arrives")
    this.color = cli.globalFlag("--no-color", "paint the output")
    this.users = cli.group(ROOT, "users", "Manage users")
    cli.command(this.users, "list", USERS_LIST, "List users")
    const get = cli.command(this.users, "get", USERS_GET, "Show one user")
    cli.argument(get, "<user-id>", "the user")
    this.keys = cli.group(this.users, "keys", "Manage a user's keys")
    this.keysList = cli.command(this.keys, "list", KEYS_LIST, "List a user's keys")
    cli.alias(this.keysList, "ls")
    this.userId = cli.argument(this.keysList, "<user-id>", "the user")
    this.limit = cli.flag(this.keysList, "-l, --limit <n>", "at most n keys")
    this.tag = cli.flag(this.keysList, "-t, --tag <tag>", "filter by tag")
    cli.repeatable(this.tag)
    this.verbose = cli.flag(this.keysList, "-V, --verbose", "say more")
    this.all = cli.flag(this.keysList, "-a, --all", "include revoked keys")
    this.format = cli.flag(this.keysList, "--format [fmt]", "print as fmt")
    cli.epilog(this.keysList, "Examples:\n  api users keys list 42 --limit 5")
    this.keysCreate = cli.command(this.keys, "create", KEYS_CREATE, "Create a key")
    cli.argument(this.keysCreate, "<user-id>", "the user")
    this.scopes = cli.argument(this.keysCreate, "[scope...]", "what the key may do")
    this.name = cli.flag(this.keysCreate, "-n, --name <name>", "the key's name")
    cli.required(this.name)
    this.dryRun = cli.flag(this.keysCreate, "--dry-run", "only say what it would create")
    cli.negatable(this.dryRun)
    const projects = cli.group(ROOT, "projects", "Manage projects")
    cli.alias(projects, "p")
    const plist = cli.command(projects, "list", PROJECTS_LIST, "List projects")
    this.projectsAll = cli.flag(plist, "--all", "include archived projects")
    const ptag = cli.command(projects, "tag", PROJECTS_TAG, "Tag a project")
    cli.argument(ptag, "<project>", "the project")
    this.tagged = cli.argument(ptag, "<tag...>", "the tags to add")
  }

  parse(args: string[]): ParseResult {
    const argv: string[] = ["/usr/bin/api"]
    for (let i: i32 = 0; i < toI32(args.length); i++) {
      argv.push(args[i])
    }
    return this.cli.parse(argv, 1)
  }
}

const flagForms = (t: Suite, api: Api): void => {
  const r = api.parse(["users", "keys", "list", "42", "--limit", "5", "-t", "a", "--tag=b", "-tc", "-t=d"])
  t.eqI32("forms: kind", r.kind, PARSE_OK)
  t.eqI32("forms: id", r.id, KEYS_LIST)
  t.eqStr("forms: path", r.path, "api users keys list")
  t.eqStr("forms: --limit 5", r.value(api.limit) ?? "-", "5")
  t.eqStr("forms: -t a, --tag=b, -tc, -t=d in order", r.values(api.tag).join(","), "a,b,c,d")
  t.eqStr("forms: positional", r.positional(api.userId) ?? "-", "42")
  t.eqI32("forms: --limit from argv", r.source(api.limit), SOURCE_ARGV)
  t.eqI32("forms: --base-url from its default", r.source(api.base), SOURCE_DEFAULT)
  t.eqStr("forms: --base-url default", r.value(api.base) ?? "-", "https://api.example.com")
  t.eqI32("forms: --token unset", r.source(api.token), SOURCE_UNSET)
  t.ok("forms: --token is null", r.value(api.token) === null)
  t.eqBool("forms: a value flag given is on", r.flag(api.limit), true)
  t.eqBool("forms: a value flag not given is off", r.flag(api.token), false)
  t.eqI32("forms: exit code", r.exitCode, 0)

  const eq = api.parse(["users", "keys", "list", "42", "--limit=7", "-l8", "--limit", "9"])
  t.eqStr("forms: the last value wins", eq.value(api.limit) ?? "-", "9")
  t.eqStr("forms: a single flag's values is the last", eq.values(api.limit).join(","), "9")
  const attached = api.parse(["users", "keys", "list", "42", "-l3"])
  t.eqStr("forms: -l3", attached.value(api.limit) ?? "-", "3")
  t.eqI32("forms: unset repeatable has no values", attached.values(api.tag).length, 0)
  const emptyShort = api.parse(["users", "keys", "list", "-l=", "42"])
  t.eqStr("forms: -l= is empty, as --limit= is", emptyShort.value(api.limit) ?? "-", "")
  t.eqStr("forms: and takes no next word", emptyShort.positional(api.userId) ?? "-", "42")
  const emptyLong = api.parse(["users", "keys", "list", "--limit=", "42"])
  t.eqStr("forms: --limit= is empty", emptyLong.value(api.limit) ?? "-", "")
  t.eqStr("forms: --limit= takes no next word", emptyLong.positional(api.userId) ?? "-", "42")
  const dash = api.parse(["users", "keys", "list", "42", "--limit", "-1"])
  t.eqStr("forms: a required value takes a dashed token", dash.value(api.limit) ?? "-", "-1")

  const cluster = api.parse(["users", "keys", "list", "42", "-Vat", "x"])
  t.eqBool("forms: cluster -V", cluster.flag(api.verbose), true)
  t.eqBool("forms: cluster -a", cluster.flag(api.all), true)
  t.eqStr("forms: cluster ends in a value flag", cluster.values(api.tag).join(","), "x")
  t.eqBool("forms: a boolean not given is off", attached.flag(api.verbose), false)
  t.eqI32("forms: a boolean not given is unset", attached.source(api.verbose), SOURCE_UNSET)

  const neg = api.parse(["--no-color", "users", "list"])
  t.eqBool("forms: --no-color turns color off", neg.flag(api.color), false)
  t.eqI32("forms: --no-color from argv", neg.source(api.color), SOURCE_ARGV)
  const plain = api.parse(["users", "list"])
  t.eqBool("forms: color is on by default", plain.flag(api.color), true)
  t.eqI32("forms: a negated flag's default is a default", plain.source(api.color), SOURCE_DEFAULT)
  const back = api.parse(["--no-color", "users", "list", "--color"])
  t.eqBool("forms: --color after --no-color turns it back on", back.flag(api.color), true)

  const opt = api.parse(["users", "keys", "list", "42", "--format"])
  t.eqStr("forms: [fmt] given none is empty", opt.value(api.format) ?? "-", "")
  t.eqBool("forms: [fmt] given none is on", opt.flag(api.format), true)
  const optv = api.parse(["users", "keys", "list", "--format", "json", "42"])
  t.eqStr("forms: [fmt] takes the next word", optv.value(api.format) ?? "-", "json")
  t.eqStr("forms: the argument after it", optv.positional(api.userId) ?? "-", "42")
  const optd = api.parse(["users", "keys", "list", "42", "--format", "-V"])
  t.eqStr("forms: [fmt] leaves a flag alone", optd.value(api.format) ?? "-", "")
  t.eqBool("forms: and the flag is read", optd.flag(api.verbose), true)

  const rest = api.parse(["users", "keys", "list", "--", "-7"])
  t.eqI32("forms: after --, kind", rest.kind, PARSE_OK)
  t.eqStr("forms: after --, a dashed positional", rest.positional(api.userId) ?? "-", "-7")
  t.eqStr("forms: rest", rest.rest().join(" "), "-7")
  const tail = api.parse(["users", "keys", "create", "1", "-n", "ci", "--", "--limit", "-n"])
  t.eqStr("forms: after --, words fill the variadic", tail.positionals(api.scopes).join(" "), "--limit -n")
  t.eqStr("forms: and rest", tail.rest().join(" "), "--limit -n")
  t.eqStr("forms: after --, -n is not a flag", tail.value(api.name) ?? "-", "ci")
  t.eqI32("forms: a word after -- still counts", api.parse(["users", "keys", "list", "1", "--", "2"]).kind, PARSE_ERROR)

  const alias = api.parse(["p", "list", "--all"])
  t.eqI32("forms: a group alias", alias.id, PROJECTS_LIST)
  t.eqStr("forms: the path names the command, not the alias", alias.path, "api projects list")
  t.eqI32("forms: a command alias", api.parse(["users", "keys", "ls", "1"]).id, KEYS_LIST)

  const variadic = api.parse(["users", "keys", "create", "7", "read", "write", "-n", "ci"])
  t.eqI32("forms: variadic, id", variadic.id, KEYS_CREATE)
  t.eqStr("forms: variadic takes the rest", variadic.positionals(api.scopes).join(","), "read,write")
  t.eqStr("forms: variadic's first", variadic.positional(api.scopes) ?? "-", "read")
  const none = api.parse(["users", "keys", "create", "7", "-n", "ci"])
  t.eqI32("forms: an optional variadic may be empty", none.positionals(api.scopes).length, 0)
  t.ok("forms: and its positional is null", none.positional(api.scopes) === null)
  t.ok("forms: another command's argument is null", variadic.positional(api.userId) === null)
  const tagged = api.parse(["p", "tag", "web", "a", "b"])
  t.eqI32("forms: required variadic, id", tagged.id, PROJECTS_TAG)
  t.eqStr("forms: required variadic takes the rest", tagged.positionals(api.tagged).join(","), "a,b")

  const dry = api.parse(["users", "keys", "create", "7", "-n", "ci", "--dry-run"])
  t.eqBool("forms: negatable --dry-run is on", dry.flag(api.dryRun), true)
  t.eqI32("forms: negatable --dry-run from argv", dry.source(api.dryRun), SOURCE_ARGV)
  const wet = api.parse(["users", "keys", "create", "7", "-n", "ci", "--dry-run", "--no-dry-run"])
  t.eqBool("forms: --no-dry-run turns it off", wet.flag(api.dryRun), false)
  t.eqI32("forms: --no-dry-run from argv", wet.source(api.dryRun), SOURCE_ARGV)
  t.eqBool("forms: negatable not given is off", none.flag(api.dryRun), false)
  t.eqI32("forms: negatable not given is unset", none.source(api.dryRun), SOURCE_UNSET)
}

const globals = (t: Suite, api: Api): void => {
  const before = api.parse(["--token", "s3", "users", "keys", "list", "1"])
  t.eqStr("globals: before the first verb", before.value(api.token) ?? "-", "s3")
  const between = api.parse(["users", "--token", "s4", "keys", "-r", "list", "1"])
  t.eqStr("globals: between verbs", between.value(api.token) ?? "-", "s4")
  t.eqBool("globals: -r between verbs", between.flag(api.raw), true)
  t.eqI32("globals: between verbs, id", between.id, KEYS_LIST)
  const after = api.parse(["users", "keys", "list", "1", "--base-url=http://localhost:8080", "-r"])
  t.eqStr("globals: after the leaf at depth 3", after.value(api.base) ?? "-", "http://localhost:8080")
  t.eqI32("globals: and its source", after.source(api.base), SOURCE_ARGV)
  t.eqBool("globals: -r after the leaf", after.flag(api.raw), true)
  const sibling = api.parse(["users", "list", "--limit", "5"])
  t.eqI32("globals: a sibling's local flag is refused", sibling.kind, PARSE_ERROR)
  t.eqStr("globals: refused, message", sibling.message, "api users list: unknown flag --limit")
  const early = api.parse(["--limit", "5", "users", "keys", "list", "1"])
  t.eqStr("globals: a leaf's flag before the leaf is refused", early.message, "api: unknown flag --limit")
}

const errors = (t: Suite, api: Api): void => {
  const cases: string[][] = [
    ["users", "kyes"],
    ["users", "keys", "list", "1", "--limt", "5"],
    ["users", "keys", "list", "1", "--zzzzzz"],
    ["users", "keys", "list", "1", "-q"],
    ["users", "keys", "list", "1", "--limit"],
    ["users", "keys", "list", "1", "-l"],
    ["users", "keys", "list", "1", "--verbose=yes"],
    ["users", "keys", "list", "1", "--no-color=yes"],
    ["users", "keys"],
    [],
    ["users", "keys", "list"],
    ["users", "keys", "list", "1", "2"],
    ["users", "keys", "create", "1"],
    ["frobnicate"],
    ["--verison"],
    ["users", "list", "-v"],
    ["users", "keys", "list", "1", "--lmt", "5"],
    ["users", "kyz"],
    ["help", "kyes"],
    ["help", "users", "kyes"],
    ["help", "users", "nope", "--help"],
    ["users", "keys", "list", "1", "-r=x"],
    ["users", "keys", "list", "1", "-ar=x"],
    ["p", "tag", "web"],
    ["p", "tag"],
  ]
  const want: string[] = [
    "api users: unknown command 'kyes' (did you mean 'keys'?)",
    "api users keys list: unknown flag --limt (did you mean --limit?)",
    "api users keys list: unknown flag --zzzzzz",
    "api users keys list: unknown flag -q",
    "api users keys list: --limit needs a value",
    "api users keys list: --limit needs a value",
    "api users keys list: --verbose takes no value",
    "api users keys list: --no-color takes no value",
    "api users keys: missing command (one of: list, create)",
    "api: missing command (one of: users, projects)",
    "api users keys list: missing argument <user-id>",
    "api users keys list: unexpected argument '2'",
    "api users keys create: missing required flag --name",
    "api: unknown command 'frobnicate'",
    "api: unknown flag --verison (did you mean --version?)",
    "api users list: unknown flag -v",
    "api users keys list: unknown flag --lmt (did you mean --limit?)",
    "api users: unknown command 'kyz' (did you mean 'keys'?)",
    "api: unknown command 'kyes'",
    "api users: unknown command 'kyes' (did you mean 'keys'?)",
    "api users: unknown command 'nope'",
    "api users keys list: -r takes no value",
    "api users keys list: -r takes no value",
    "api projects tag: missing argument <tag...>",
    "api projects tag: missing argument <project>",
  ]
  const hints: string[] = [
    "Run 'api users --help' for usage.",
    "Run 'api users keys list --help' for usage.",
    "Run 'api users keys list --help' for usage.",
    "Run 'api users keys list --help' for usage.",
    "Run 'api users keys list --help' for usage.",
    "Run 'api users keys list --help' for usage.",
    "Run 'api users keys list --help' for usage.",
    "Run 'api users keys list --help' for usage.",
    "Run 'api users keys --help' for usage.",
    "Run 'api --help' for usage.",
    "Run 'api users keys list --help' for usage.",
    "Run 'api users keys list --help' for usage.",
    "Run 'api users keys create --help' for usage.",
    "Run 'api --help' for usage.",
    "Run 'api --help' for usage.",
    "Run 'api users list --help' for usage.",
    "Run 'api users keys list --help' for usage.",
    "Run 'api users --help' for usage.",
    "Run 'api --help' for usage.",
    "Run 'api users --help' for usage.",
    "Run 'api users --help' for usage.",
    "Run 'api users keys list --help' for usage.",
    "Run 'api users keys list --help' for usage.",
    "Run 'api projects tag --help' for usage.",
    "Run 'api projects tag --help' for usage.",
  ]
  t.eqI32("errors: a message for every case", toI32(want.length), toI32(cases.length))
  t.eqI32("errors: a hint for every case", toI32(hints.length), toI32(cases.length))
  for (let i: i32 = 0; i < toI32(cases.length) && i < toI32(want.length); i++) {
    const args = cases[i]
    const expected = want[i]
    const r = api.parse(args)
    const label = `errors: ${args.join(" ")}`
    t.eqI32(`${label}: kind`, r.kind, PARSE_ERROR)
    t.eqI32(`${label}: exit code`, r.exitCode, 2)
    t.eqStr(`${label}: message`, r.message, expected)
    if (i < toI32(hints.length)) {
      t.eqStr(`${label}: hint`, r.hint, hints[i])
    }
  }
  const first = api.parse(["users", "keys", "list", "--zzzzz", "1", "2"])
  t.eqStr("errors: the first error wins", first.message, "api users keys list: unknown flag --zzzzz")
  const stuck = api.parse(["users", "kyes", "list"])
  t.eqStr("errors: an unknown command stops the descent", stuck.errorPath, "api users")
}

const helpAndVersion = (t: Suite, api: Api): void => {
  const h = api.parse(["users", "keys", "list", "-h"])
  t.eqI32("help: -h", h.kind, PARSE_HELP)
  t.eqI32("help: exit code", h.exitCode, 0)
  t.eqI32("help: for the command it reached", h.command, api.keysList)
  t.eqI32("help: --help", api.parse(["users", "--help"]).kind, PARSE_HELP)
  t.eqI32("help: in a cluster", api.parse(["users", "keys", "list", "-Vh"]).kind, PARSE_HELP)
  t.eqI32("help: wins over an error", api.parse(["users", "kyes", "--help"]).kind, PARSE_HELP)
  const path = api.parse(["help", "users", "keys"])
  t.eqI32("help: help <path>", path.kind, PARSE_HELP)
  t.eqI32("help: help <path> reaches it", path.command, api.keys)
  t.eqI32("help: help alone", api.parse(["help"]).kind, PARSE_HELP)
  const badPath = api.parse(["help", "users", "kyes"])
  t.eqI32("help: help <unknown path> is an error", badPath.kind, PARSE_ERROR)
  t.eqI32("help: help <unknown path> exits 2", badPath.exitCode, 2)
  t.eqI32("help: help <unknown path> --version is still an error", api.parse(["help", "kyes", "--version"]).kind, PARSE_ERROR)
  t.eqI32("help: after --, -h is a word", api.parse(["users", "keys", "list", "--", "-h"]).kind, PARSE_OK)
  const v = api.parse(["--version"])
  t.eqI32("version: --version", v.kind, PARSE_VERSION)
  t.eqStr("version: message", v.message, "api 1.4.0")
  t.eqI32("version: exit code", v.exitCode, 0)
  t.eqI32("version: -v", api.parse(["-v"]).kind, PARSE_VERSION)
  t.eqI32("version: -v below the root is unknown", api.parse(["users", "-v"]).kind, PARSE_ERROR)
}

const helpPages = (t: Suite, api: Api): void => {
  const plain = new Style(false, false)
  t.eqLines("help page: root", splitLines(api.cli.helpText(ROOT, plain)), [
    "api 1.4.0  Talk to the Example API",
    "",
    "usage: api <command> [flags]",
    "",
    "Commands",
    "  users             Manage users",
    "  projects, p       Manage projects",
    "",
    "Flags",
    "  -h, --help        show help",
    "  -v, --version     show the version",
    "",
    "Global flags",
    "  --base-url <url>  API base URL (default: https://api.example.com)",
    "  --token <token>   the API token",
    "  -r, --raw-output  print JSON as it arrives",
    "  --[no-]color      paint the output",
  ])
  t.eqLines("help page: group", splitLines(api.cli.helpText(api.keys, plain)), [
    "api 1.4.0  Talk to the Example API",
    "",
    "usage: api users keys <command> [flags]   Manage a user's keys",
    "",
    "Commands",
    "  list, ls          List a user's keys",
    "  create            Create a key",
    "",
    "Flags",
    "  -h, --help        show help",
    "",
    "Global flags",
    "  --base-url <url>  API base URL (default: https://api.example.com)",
    "  --token <token>   the API token",
    "  -r, --raw-output  print JSON as it arrives",
    "  --[no-]color      paint the output",
  ])
  t.eqLines("help page: leaf", splitLines(api.parse(["users", "keys", "list", "--help"]).help(plain)), [
    "api 1.4.0  Talk to the Example API",
    "",
    "usage: api users keys list <user-id> [flags]   List a user's keys",
    "",
    "Arguments",
    "  <user-id>         the user",
    "",
    "Flags",
    "  -l, --limit <n>   at most n keys",
    "  -t, --tag <tag>   filter by tag (repeatable)",
    "  -V, --verbose     say more",
    "  -a, --all         include revoked keys",
    "  --format [fmt]    print as fmt",
    "  -h, --help        show help",
    "",
    "Global flags",
    "  --base-url <url>  API base URL (default: https://api.example.com)",
    "  --token <token>   the API token",
    "  -r, --raw-output  print JSON as it arrives",
    "  --[no-]color      paint the output",
    "",
    "Examples:",
    "  api users keys list 42 --limit 5",
  ])
  t.eqLines("help page: required, variadic and negatable", splitLines(api.cli.helpText(api.keysCreate, plain)), [
    "api 1.4.0  Talk to the Example API",
    "",
    "usage: api users keys create <user-id> [scope...] [flags]   Create a key",
    "",
    "Arguments",
    "  <user-id>          the user",
    "  [scope...]         what the key may do",
    "",
    "Flags",
    "  -n, --name <name>  the key's name (required)",
    "  --[no-]dry-run     only say what it would create",
    "  -h, --help         show help",
    "",
    "Global flags",
    "  --base-url <url>   API base URL (default: https://api.example.com)",
    "  --token <token>    the API token",
    "  -r, --raw-output   print JSON as it arrives",
    "  --[no-]color       paint the output",
  ])
}

// A tree of 20 groups of 25 commands, each with 8 flags of its own.
class Wide {
  cli: Cli
  lastLeaf: i32
  lastFlag: i32

  constructor() {
    const cli = new Cli("wide", "0.0.1", "five hundred commands")
    this.cli = cli
    this.lastLeaf = -1
    this.lastFlag = -1
    for (let g: i32 = 0; g < 20; g++) {
      this.addGroup(g)
    }
  }

  addGroup(g: i32): void {
    const group = this.cli.group(ROOT, `group${g}`, `group ${g}`)
    for (let c: i32 = 0; c < 25; c++) {
      this.addLeaf(group, g * 25 + c, c)
    }
  }

  addLeaf(group: i32, id: i32, c: i32): void {
    const leaf = this.cli.command(group, `cmd${c}`, id, `command ${id}`)
    this.lastLeaf = leaf
    for (let f: i32 = 0; f < 8; f++) {
      this.lastFlag = this.cli.flag(leaf, `--opt${f} <v>`, `option ${f}`)
    }
  }
}

const wideTree = (t: Suite): void => {
  const wide = new Wide()
  const argv: string[] = ["wide", "group19", "cmd24", "--opt0", "a", "--opt7=b", "--opt3", "c"]
  const r = wide.cli.parse(argv, 1)
  t.eqI32("wide: the last leaf's id", r.id, 499)
  t.eqStr("wide: its last flag", r.value(wide.lastFlag) ?? "-", "b")
  const runs: i32 = 10000
  let ok: i32 = 0
  const start = monotonicNanos()
  for (let i: i32 = 0; i < runs; i++) {
    ok = ok + (wide.cli.parse(argv, 1).id === 499 ? 1 : 0)
  }
  const nanos = toF64(monotonicNanos() - start)
  t.eqI32("wide: every parse finds it", ok, runs)
  // Measured at 0.93 to 1.07 µs a parse under the debug profile the harness
  // links with, on a 4-core cloud session; the bound is ten times that, so
  // only a change in kind (a walk over the tree per token) fails it.
  const perParse = nanos / toF64(runs)
  t.ok("wide: a parse is under 10 µs", perParse < 10000.0)
}

export const main = (): i32 => {
  const t = new Suite("std/cli-args")
  const api = new Api()
  flagForms(t, api)
  globals(t, api)
  errors(t, api)
  helpAndVersion(t, api)
  helpPages(t, api)
  wideTree(t)
  return t.done()
}
