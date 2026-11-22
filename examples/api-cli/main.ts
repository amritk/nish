// A command tree for an HTTP API's command-line client, on `nish/cli-args`:
// `users list|get|keys list|keys create` and `projects list`, with global
// flags that may stand before, between or after the verbs. It sends no
// requests: each command prints, as JSON, the call it would make, so the
// parse is what it shows.
//   nish examples/api-cli/main.ts --link build/api-cli
//   ./build/api-cli users keys list 42 --limit 5 -t ci -t deploy
//   ./build/api-cli --help; ./build/api-cli users kyes
// smoke: argv users get 7 --raw-output
import { Cli, CliArgument, CliFlag, ParseResult, ROOT, SOURCE_ARGV, finish } from "nish/cli-args"
import { agentDriven, styleFor } from "nish/cli"
import { JsonWriter } from "nish/json"

/** argv[0] is the program; its arguments start at 1. */
const FIRST_ARG: i32 = 1

const USERS_LIST: i32 = 1
const USERS_GET: i32 = 2
const KEYS_LIST: i32 = 3
const KEYS_CREATE: i32 = 4
const PROJECTS_LIST: i32 = 5

/** Writes `key` and the strings in `xs` as an array. */
const list = (w: JsonWriter, key: string, xs: string[]): void => {
  w.key(key)
  w.beginArray()
  for (const x of xs) {
    w.string(x)
  }
  w.endArray()
}

/**
 * The tree and every flag and argument the dispatch reads. A class, because a
 * module constant can only be a number, boolean or string; `declare` builds it.
 */
class Api {
  cli: Cli
  baseUrl: CliFlag
  token: CliFlag
  raw: CliFlag
  output: CliFlag
  profile: CliFlag
  getUser: CliArgument
  keysUser: CliArgument
  limit: CliFlag
  tag: CliFlag
  all: CliFlag
  createUser: CliArgument
  name: CliFlag
  scopes: CliArgument
  projectsAll: CliFlag

  constructor(
    cli: Cli,
    baseUrl: CliFlag,
    token: CliFlag,
    raw: CliFlag,
    output: CliFlag,
    profile: CliFlag,
    getUser: CliArgument,
    keysUser: CliArgument,
    limit: CliFlag,
    tag: CliFlag,
    all: CliFlag,
    createUser: CliArgument,
    name: CliFlag,
    scopes: CliArgument,
    projectsAll: CliFlag
  ) {
    this.cli = cli
    this.baseUrl = baseUrl
    this.token = token
    this.raw = raw
    this.output = output
    this.profile = profile
    this.getUser = getUser
    this.keysUser = keysUser
    this.limit = limit
    this.tag = tag
    this.all = all
    this.createUser = createUser
    this.name = name
    this.scopes = scopes
    this.projectsAll = projectsAll
  }
}

/**
 * Declares the tree, or says which declaration is wrong: a misdeclared tree is
 * this program's bug, so `main` reports it and exits 70 rather than parse.
 */
const declare = (): Result<Api, string> => {
  const cli = new Cli("api", "1.4.0", "Talk to the Example API")
  const baseUrl = cli.tryGlobalFlag("--base-url <url>", "API base URL").orReturn()
  cli.tryDefaultValue(baseUrl.handle, "https://api.example.com").orReturn()
  const token = cli.tryGlobalFlag("--token <token>", "bearer token for the request").orReturn()
  const raw = cli.tryGlobalFlag("-r, --raw-output", "print the response as it arrives").orReturn()
  const output = cli.tryGlobalFlag("-o, --output <format>", "json or table").orReturn()
  cli.tryDefaultValue(output.handle, "table").orReturn()
  const profile = cli
    .tryGlobalFlag("--profile <name>", "read the base URL and token from this profile")
    .orReturn()

  const users = cli.tryGroup(ROOT, "users", "Manage users").orReturn()
  cli.tryCommand(users, "list", USERS_LIST, "List users").orReturn()
  const get = cli.tryCommand(users, "get", USERS_GET, "Show one user").orReturn()
  const getUser = cli.tryArgument(get, "<user-id>", "the user to show").orReturn()

  const keys = cli.tryGroup(users, "keys", "Manage a user's API keys").orReturn()
  const keysList = cli.tryCommand(keys, "list", KEYS_LIST, "List a user's keys").orReturn()
  cli.tryAlias(keysList, "ls").orReturn()
  const keysUser = cli.tryArgument(keysList, "<user-id>", "whose keys").orReturn()
  const limit = cli.tryFlag(keysList, "-l, --limit <n>", "at most n keys").orReturn()
  const tag = cli.tryFlag(keysList, "-t, --tag <tag>", "only keys with this tag").orReturn()
  cli.tryRepeatable(tag.handle).orReturn()
  const all = cli.tryFlag(keysList, "-a, --all", "include revoked keys").orReturn()
  cli.tryEpilog(keysList, "Tags combine: a key must carry every one given.").orReturn()

  const create = cli.tryCommand(keys, "create", KEYS_CREATE, "Create a key").orReturn()
  const createUser = cli.tryArgument(create, "<user-id>", "whose key").orReturn()
  const scopes = cli.tryArgument(create, "[scope...]", "what the key may do").orReturn()
  const name = cli.tryFlag(create, "-n, --name <name>", "a label for the key").orReturn()
  cli.tryRequired(name.handle).orReturn()

  const projects = cli.tryGroup(ROOT, "projects", "Manage projects").orReturn()
  cli.tryAlias(projects, "p").orReturn()
  const projectsList = cli.tryCommand(projects, "list", PROJECTS_LIST, "List projects").orReturn()
  const projectsAll = cli.tryFlag(projectsList, "--all", "include archived projects").orReturn()
  return Ok(
    new Api(
      cli,
      baseUrl,
      token,
      raw,
      output,
      profile,
      getUser,
      keysUser,
      limit,
      tag,
      all,
      createUser,
      name,
      scopes,
      projectsAll
    )
  )
}

/**
 * Opens the JSON object for `method` on `route` with the global settings, in a
 * buffer sized for the worst case of every argument escaped; the command adds
 * its own keys and `send` closes and prints it.
 */
const call = (api: Api, r: ParseResult, method: string, route: string): JsonWriter => {
  // `u32`, which wraps rather than panics, and cannot wrap here: the kernel
  // caps the whole argument list at a few MiB, so six times it is far below
  // 2^32. The buffer is filled by `push` because a `u32` length is checked.
  let size: u32 = toU32(512) + toU32(6) * toU32(route.length)
  for (const arg of process.argv) {
    size += toU32(6) * toU32(arg.length)
  }
  const buf: u8[] = []
  for (let i: u32 = 0; i < size; i++) {
    buf.push(0)
  }
  const w = new JsonWriter(buf, 0)
  let tokenFrom = "none"
  if (r.readSource(api.token) === SOURCE_ARGV) {
    tokenFrom = "flag"
  } else if (r.readSource(api.profile) === SOURCE_ARGV) {
    tokenFrom = "profile"
  }
  w.beginObject()
  w.key("method")
  w.string(method)
  w.key("url")
  w.string(`${r.readValue(api.baseUrl) ?? ""}${route}`)
  w.key("output")
  w.string(r.readValue(api.output) ?? "")
  w.key("raw")
  w.boolean(r.readFlag(api.raw))
  w.key("token")
  w.string(tokenFrom)
  return w
}

/** Closes the object `call` opened and prints it. */
const send = (w: JsonWriter): void => {
  w.endObject()
  console.log(w.text())
}

export const main = (): i32 => {
  const declared = declare()
  if (declared.isErr()) {
    console.error(declared.error)
    return 70
  }
  const api = declared.value
  const agent = agentDriven()
  const r = api.cli.parse(process.argv, FIRST_ARG)
  finish(r, styleFor(1, agent), styleFor(2, agent))

  // A rule the tree cannot state: a profile supplies the base URL, so an
  // explicit --base-url conflicts with it. --base-url always has a value (its
  // default), so only `source` tells one the user typed from the default.
  if (r.readSource(api.profile) === SOURCE_ARGV && r.readSource(api.baseUrl) === SOURCE_ARGV) {
    console.error(`${r.path}: --profile supplies the base URL; drop --base-url or --profile`)
    return 2
  }
  if (r.readSource(api.profile) === SOURCE_ARGV && r.readSource(api.token) === SOURCE_ARGV) {
    console.error(`${r.path}: --token and --profile both name the token; give one`)
    return 2
  }
  const output = r.readValue(api.output) ?? ""
  if (output !== "json" && output !== "table") {
    console.error(`${r.path}: --output must be json or table, not '${output}'`)
    return 2
  }

  switch (r.id) {
    case USERS_LIST:
      send(call(api, r, "GET", "/users"))
      break
    case USERS_GET:
      send(call(api, r, "GET", `/users/${r.readPositional(api.getUser) ?? ""}`))
      break
    case KEYS_LIST: {
      const w = call(api, r, "GET", `/users/${r.readPositional(api.keysUser) ?? ""}/keys`)
      w.key("limit")
      const limit = r.readValue(api.limit)
      if (limit === null) {
        w.nullValue()
      } else {
        w.string(limit)
      }
      list(w, "tags", r.readValues(api.tag))
      w.key("all")
      w.boolean(r.readFlag(api.all))
      send(w)
      break
    }
    case KEYS_CREATE: {
      const w = call(api, r, "POST", `/users/${r.readPositional(api.createUser) ?? ""}/keys`)
      w.key("name")
      w.string(r.readValue(api.name) ?? "")
      list(w, "scopes", r.readPositionals(api.scopes))
      send(w)
      break
    }
    case PROJECTS_LIST:
      send(call(api, r, "GET", r.readFlag(api.projectsAll) ? "/projects?archived=1" : "/projects"))
      break
  }
  return 0
}
