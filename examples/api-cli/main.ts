// A command tree for an HTTP API's command-line client, on `nish/cli-args`:
// `users list|get|keys list|keys create` and `projects list`, with global
// flags that may stand before, between or after the verbs. It sends no
// requests: each command prints, as JSON, the call it would make, so the
// parse is what it shows.
//   nish examples/api-cli/main.ts --link build/api-cli
//   ./build/api-cli users keys list 42 --limit 5 -t ci -t deploy
//   ./build/api-cli --help; ./build/api-cli users kyes
// smoke: argv users get 7 --raw-output
import { Cli, ParseResult, ROOT, SOURCE_ARGV, finish } from "nish/cli-args"
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
  for (let i = 0; i < xs.length; i++) {
    w.string(xs[i])
  }
  w.endArray()
}

/**
 * The tree and a handle for every flag and argument the dispatch reads. A
 * class, because a module constant can only be a number, boolean or string.
 */
class Api {
  cli: Cli
  baseUrl: i32
  token: i32
  raw: i32
  output: i32
  profile: i32
  getUser: i32
  keysUser: i32
  limit: i32
  tag: i32
  all: i32
  createUser: i32
  name: i32
  scopes: i32
  projectsAll: i32

  constructor() {
    const cli = new Cli("api", "1.4.0", "Talk to the Example API")
    this.cli = cli
    this.baseUrl = cli.globalFlag("--base-url <url>", "API base URL")
    cli.defaultValue(this.baseUrl, "https://api.example.com")
    this.token = cli.globalFlag("--token <token>", "bearer token for the request")
    this.raw = cli.globalFlag("-r, --raw-output", "print the response as it arrives")
    this.output = cli.globalFlag("-o, --output <format>", "json or table")
    cli.defaultValue(this.output, "table")
    this.profile = cli.globalFlag("--profile <name>", "read the base URL and token from this profile")

    const users = cli.group(ROOT, "users", "Manage users")
    cli.command(users, "list", USERS_LIST, "List users")
    const get = cli.command(users, "get", USERS_GET, "Show one user")
    this.getUser = cli.argument(get, "<user-id>", "the user to show")

    const keys = cli.group(users, "keys", "Manage a user's API keys")
    const keysList = cli.command(keys, "list", KEYS_LIST, "List a user's keys")
    cli.alias(keysList, "ls")
    this.keysUser = cli.argument(keysList, "<user-id>", "whose keys")
    this.limit = cli.flag(keysList, "-l, --limit <n>", "at most n keys")
    this.tag = cli.flag(keysList, "-t, --tag <tag>", "only keys with this tag")
    cli.repeatable(this.tag)
    this.all = cli.flag(keysList, "-a, --all", "include revoked keys")
    cli.epilog(keysList, "Tags combine: a key must carry every one given.")

    const create = cli.command(keys, "create", KEYS_CREATE, "Create a key")
    this.createUser = cli.argument(create, "<user-id>", "whose key")
    this.scopes = cli.argument(create, "[scope...]", "what the key may do")
    this.name = cli.flag(create, "-n, --name <name>", "a label for the key")
    cli.required(this.name)

    const projects = cli.group(ROOT, "projects", "Manage projects")
    cli.alias(projects, "p")
    const projectsList = cli.command(projects, "list", PROJECTS_LIST, "List projects")
    this.projectsAll = cli.flag(projectsList, "--all", "include archived projects")
  }
}

/**
 * Opens the JSON object for `method` on `route` with the global settings, in a
 * buffer sized for the worst case of every argument escaped; the command adds
 * its own keys and `send` closes and prints it.
 */
const call = (api: Api, r: ParseResult, method: string, route: string): JsonWriter => {
  let size = 512 + 6 * route.length
  for (let i = 0; i < process.argv.length; i++) {
    size += 6 * process.argv[i].length
  }
  const w = new JsonWriter(new Array<u8>(size), 0)
  let tokenFrom = "none"
  if (r.source(api.token) === SOURCE_ARGV) {
    tokenFrom = "flag"
  } else if (r.source(api.profile) === SOURCE_ARGV) {
    tokenFrom = "profile"
  }
  w.beginObject()
  w.key("method")
  w.string(method)
  w.key("url")
  w.string(`${r.value(api.baseUrl) ?? ""}${route}`)
  w.key("output")
  w.string(r.value(api.output) ?? "")
  w.key("raw")
  w.boolean(r.flag(api.raw))
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
  const api = new Api()
  const agent = agentDriven()
  const r = api.cli.parse(process.argv, FIRST_ARG)
  finish(r, styleFor(1, agent), styleFor(2, agent))

  // A rule the tree cannot state: a profile supplies the base URL, so an
  // explicit --base-url conflicts with it. --base-url always has a value (its
  // default), so only `source` tells one the user typed from the default.
  if (r.source(api.profile) === SOURCE_ARGV && r.source(api.baseUrl) === SOURCE_ARGV) {
    console.error(`${r.path}: --profile supplies the base URL; drop --base-url or --profile`)
    return 2
  }
  if (r.source(api.profile) === SOURCE_ARGV && r.source(api.token) === SOURCE_ARGV) {
    console.error(`${r.path}: --token and --profile both name the token; give one`)
    return 2
  }
  const output = r.value(api.output) ?? ""
  if (output !== "json" && output !== "table") {
    console.error(`${r.path}: --output must be json or table, not '${output}'`)
    return 2
  }

  switch (r.id) {
    case USERS_LIST:
      send(call(api, r, "GET", "/users"))
      break
    case USERS_GET:
      send(call(api, r, "GET", `/users/${r.positional(api.getUser) ?? ""}`))
      break
    case KEYS_LIST: {
      const w = call(api, r, "GET", `/users/${r.positional(api.keysUser) ?? ""}/keys`)
      w.key("limit")
      const limit = r.value(api.limit)
      if (limit === null) {
        w.nullValue()
      } else {
        w.string(limit)
      }
      list(w, "tags", r.values(api.tag))
      w.key("all")
      w.boolean(r.flag(api.all))
      send(w)
      break
    }
    case KEYS_CREATE: {
      const w = call(api, r, "POST", `/users/${r.positional(api.createUser) ?? ""}/keys`)
      w.key("name")
      w.string(r.value(api.name) ?? "")
      list(w, "scopes", r.positionals(api.scopes))
      send(w)
      break
    }
    case PROJECTS_LIST:
      send(call(api, r, "GET", r.flag(api.projectsAll) ? "/projects?archived=1" : "/projects"))
      break
  }
  return 0
}
