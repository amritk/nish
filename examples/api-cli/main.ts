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
import { replaceAll } from "nish/text"

const USERS_LIST: i32 = 1
const USERS_GET: i32 = 2
const KEYS_LIST: i32 = 3
const KEYS_CREATE: i32 = 4
const PROJECTS_LIST: i32 = 5

/** A JSON string literal for `s`: backslashes and quotes escaped. */
const quote = (s: string): string => `"${replaceAll(replaceAll(s, "\\", "\\\\"), '"', '\\"')}"`

/** A JSON array of the strings in `xs`. */
const list = (xs: string[]): string => {
  const quoted: string[] = []
  for (let i = 0; i < xs.length; i++) {
    quoted.push(quote(xs[i]))
  }
  return `[${quoted.join(",")}]`
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
    this.profile = cli.globalFlag("--profile <name>", "read the token from this profile")

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

/** The request line for `method` on `route`, as a JSON object with the global settings. */
const call = (api: Api, r: ParseResult, method: string, route: string, extra: string): string => {
  const base = r.value(api.baseUrl) ?? ""
  const output = r.value(api.output) ?? ""
  let tokenFrom = "none"
  if (r.source(api.token) === SOURCE_ARGV) {
    tokenFrom = "flag"
  } else if (r.source(api.profile) === SOURCE_ARGV) {
    tokenFrom = "profile"
  }
  return `{"method":${quote(method)},"url":${quote(`${base}${route}`)},"output":${quote(output)},"raw":${r.flag(api.raw)},"token":${quote(tokenFrom)}${extra}}`
}

export const main = (): i32 => {
  const api = new Api()
  const agent = agentDriven()
  const r = api.cli.parse(process.argv, 1)
  finish(r, styleFor(1, agent), styleFor(2, agent))

  // A rule the tree cannot state: `source` tells a flag given from one left
  // at its default, so the check reads what the user typed.
  if (r.source(api.token) === SOURCE_ARGV && r.source(api.profile) === SOURCE_ARGV) {
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
      console.log(call(api, r, "GET", "/users", ""))
      break
    case USERS_GET:
      console.log(call(api, r, "GET", `/users/${r.positional(api.getUser) ?? ""}`, ""))
      break
    case KEYS_LIST: {
      const limit = r.value(api.limit)
      const shown = limit === null ? "null" : quote(limit)
      const extra = `,"limit":${shown},"tags":${list(r.values(api.tag))},"all":${r.flag(api.all)}`
      console.log(call(api, r, "GET", `/users/${r.positional(api.keysUser) ?? ""}/keys`, extra))
      break
    }
    case KEYS_CREATE: {
      const extra = `,"name":${quote(r.value(api.name) ?? "")},"scopes":${list(r.positionals(api.scopes))}`
      console.log(call(api, r, "POST", `/users/${r.positional(api.createUser) ?? ""}/keys`, extra))
      break
    }
    case PROJECTS_LIST:
      console.log(call(api, r, "GET", r.flag(api.projectsAll) ? "/projects?archived=1" : "/projects", ""))
      break
  }
  return 0
}
