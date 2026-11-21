// Argument parsing (std/cli-args.ts) under an instruction count: one tree of
// two levels, and `n` parses of command lines that take every flag form, a
// repeatable flag, a variadic argument and a default. It reaches the lookups
// whose panic sites the std/ ratchet counts, so a fix to one of them shows
// here as a count that holds or falls. It prints a sum over what it parsed.
import { Cli, PARSE_OK, ROOT } from "nish/cli-args"

export const main = (): i32 => {
  const n: i32 = 20000 // bench:n
  const cli = new Cli("api", "1.0.0", "Talk to an API")
  const base = cli.globalFlag("--base-url <url>", "API base URL")
  cli.defaultValue(base, "https://api.example.com")
  const quiet = cli.globalFlag("-q, --quiet", "say less")
  const keys = cli.group(ROOT, "keys", "Manage keys")
  const list = cli.command(keys, "list", 1, "List keys")
  const user = cli.argument(list, "<user-id>", "the user")
  const limit = cli.flag(list, "-l, --limit <n>", "at most n keys")
  const tag = cli.flag(list, "-t, --tag <tag>", "filter by tag")
  cli.repeatable(tag)
  const create = cli.command(keys, "create", 2, "Create a key")
  cli.argument(create, "<user-id>", "the user")
  const scopes = cli.argument(create, "[scope...]", "what the key may do")
  const lines: string[][] = [
    ["/usr/bin/api", "keys", "list", "42", "--limit", "5", "-t", "a", "--tag=b", "-tc", "-q"],
    ["/usr/bin/api", "--base-url=http://localhost", "keys", "create", "7", "read", "write", "admin"],
    ["/usr/bin/api", "keys", "list", "-l9", "1000"],
  ]
  let sum: i64 = 0
  for (let round: i32 = 0; round < n; round++) {
    const argv = lines[round % 3]
    const r = cli.parse(argv, 1)
    if (r.kind !== PARSE_OK) {
      console.log(`parse failed on line ${round % 3}`)
      return 1
    }
    sum += toI64(r.id) + toI64(r.values(tag).length) + toI64(r.values(scopes).length)
    sum += toI64((r.value(limit) ?? "").length) + toI64((r.value(base) ?? "").length)
    sum += toI64((r.positional(user) ?? "").length) + (r.flag(quiet) ? 1 : 0)
  }
  console.log(`${sum}`)
  return 0
}
