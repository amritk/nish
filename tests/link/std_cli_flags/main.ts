// `nish/cli-flags` over every rule of its grammar and every usage error: each
// line is one command line read against one table, printed as the command,
// the flags it set and the positionals, or as the two lines `exitUsage` would
// write. The argument lists are written out here because a link test runs
// with none of its own.
import { HelpMenu, Style } from "nish/cli"
import { FlagTable, ParsedFlags } from "nish/cli-flags"
import { replaceAll } from "nish/text"

const flat = (table: FlagTable): FlagTable => {
  table.string("output", "<file>", "where to write")
  table.number("jobs", "<n>", "parallel jobs")
  table.boolean("verbose", "say more")
  table.repeatable("include", "<dir>", "search here too")
  return table
}

const plain = (): FlagTable => flat(new FlagTable("tool"))

const git = (): FlagTable => {
  const t = new FlagTable("git-lite")
  t.command("status", "", "show the state")
  t.command("remote", "", "list remotes")
  t.command("remote add", "<name> <url>", "add a remote")
  t.command("remote  remove", "<name>", "drop a remote")
  return flat(t)
}

// Only `remote add` and `remote remove`, so `remote` alone spells no command.
const remotes = (): FlagTable => {
  const t = new FlagTable("remotes")
  t.command("remote add", "<name> <url>", "add a remote")
  t.command("remote remove", "<name>", "drop a remote")
  return flat(t)
}

const quoted = (words: string[]): string => {
  const parts: string[] = []
  for (const w of words) {
    parts.push(`"${w}"`)
  }
  return `[${parts.join(" ")}]`
}

const report = (got: ParsedFlags): string => {
  if (!got.ok) {
    const text = got.usageError()
    return `error ${got.code} at "${got.argument}": ${replaceAll(text.substring(0, text.length - 1), "\n", " / ")}`
  }
  const set: string[] = []
  if (got.has("output")) {
    set.push(`output="${got.str("output")}"`)
  }
  if (got.has("jobs")) {
    set.push(`jobs=${got.num("jobs")}`)
  }
  if (got.has("verbose")) {
    set.push(`verbose=${got.bool("verbose")}`)
  }
  if (got.has("include")) {
    set.push(`include=${quoted(got.all("include"))}`)
  }
  return `command "${got.command}" {${set.join(" ")}} ${quoted(got.positionals)}`
}

// The answer's public arrays, one element per flag in declaration order.
const arrays = (got: ParsedFlags): void => {
  const counts: string[] = []
  for (const c of got.counts) {
    counts.push(`${c}`)
  }
  const numbers: string[] = []
  for (const n of got.numbers) {
    numbers.push(`${n}`)
  }
  const bools: string[] = []
  for (const b of got.bools) {
    bools.push(`${b}`)
  }
  const lists: string[] = []
  for (const l of got.lists) {
    lists.push(quoted(l))
  }
  console.log(`counts ${counts.join(",")}; texts ${quoted(got.texts)}; numbers ${numbers.join(",")}`)
  console.log(`  bools ${bools.join(",")}; lists ${lists.join(" ")}`)
}

const show = (table: FlagTable, args: string[]): void => {
  console.log(`${quoted(args)} -> ${report(table.parse(args))}`)
}

export const main = (): i32 => {
  console.log("grammar:")
  show(plain(), [])
  show(plain(), ["--output", "a.txt", "--jobs", "4", "--verbose", "--include", "x", "--include", "y"])
  show(plain(), ["--output=a=b", "--jobs=-2.5", "--include="])
  show(plain(), ["--output=", "--no-verbose"])
  show(plain(), ["--jobs", "-1", "--output", "--verbose"])
  show(plain(), ["--jobs", "1e3"])
  show(plain(), ["--jobs", "+5"])
  show(plain(), ["--jobs", ".5"])
  show(plain(), ["--jobs", "-.5e-2"])
  show(plain(), ["--jobs", "5."])
  show(plain(), ["--output", "--"])
  show(plain(), ["--", "-3"])
  show(plain(), ["one", "--verbose", "two", "-", "three"])
  show(plain(), ["a", "--", "--verbose", "-x", "--"])
  const argv: string[] = ["/bin/tool", "--verbose", "x"]
  console.log(`parseFrom 1 -> ${report(plain().parseFrom(argv, 1))}`)
  console.log(`parseFrom 3 -> ${report(plain().parseFrom(argv, 3))}`)
  console.log("absent:")
  const noArgs: string[] = []
  const none = plain().parse(noArgs)
  console.log(`"${none.str("output")}" ${none.num("jobs")} ${none.bool("verbose")} ${none.all("include").length}`)
  console.log("commands:")
  show(git(), [])
  show(git(), ["status"])
  show(git(), ["remote"])
  show(git(), ["remote", "add", "origin", "u"])
  show(git(), ["--verbose", "remote", "--include", "i", "add", "origin"])
  show(git(), ["remote", "remove", "old"])
  show(git(), ["remote", "--", "add"])
  show(git(), ["remote", "rename", "a"])
  console.log("errors:")
  show(plain(), ["--colour"])
  show(plain(), ["-v"])
  show(plain(), ["--no-output"])
  show(plain(), ["--output"])
  show(plain(), ["--jobs"])
  show(plain(), ["--jobs", "many"])
  show(plain(), ["--jobs", ""])
  show(plain(), ["--jobs", " 4"])
  show(plain(), ["--jobs=4 "])
  show(plain(), ["--jobs", "\t4"])
  show(plain(), ["--jobs", "4\t"])
  show(plain(), ["--jobs", "4\u00a0"])
  show(plain(), ["--jobs="])
  show(plain(), ["--jobs", "0x1A"])
  show(plain(), ["--jobs", "0b11"])
  show(plain(), ["--jobs", "0o7"])
  show(plain(), ["--jobs", "0x1p3"])
  show(plain(), ["--jobs", "1e999"])
  show(plain(), ["--jobs", "1e"])
  show(plain(), ["--jobs", "1e+"])
  show(plain(), ["--jobs", "."])
  show(plain(), ["--jobs", "+-1"])
  show(plain(), ["--jobs", "1_000"])
  show(plain(), ["--jobs", "Infinity"])
  show(plain(), ["--jobs", "NaN"])
  show(plain(), ["--output", "a", "--output=b"])
  show(plain(), ["--output=a", "--output=b"])
  show(plain(), ["--=x"])
  show(plain(), ["--no-jobs"])
  show(plain(), ["--verbose", "--no-verbose"])
  show(plain(), ["--jobs", "1", "--jobs", "1"])
  show(plain(), ["--verbose=yes"])
  show(plain(), ["--no-verbose=1"])
  show(git(), ["push"])
  show(remotes(), ["remote", "rename", "a"])
  show(remotes(), ["remote"])
  show(remotes(), ["remote", "add", "origin"])
  show(git(), ["remote", "add", "--jobs", "x"])
  show(git(), ["--bogus", "push"])
  console.log("no- names:")
  // A flag named `no-x` beside a flag `x` that is not a boolean: `--no-x`
  // is the flag of that name, and `--no-` alone names no flag.
  const negations = new FlagTable("neg")
  negations.string("cache", "<dir>", "cache here")
  negations.string("no-cache", "<why>", "do not cache")
  negations.boolean("verbose", "say more")
  const negated = negations.parse(["--no-cache", "slow", "--no-verbose"])
  console.log(`"${negated.str("no-cache")}" "${negated.str("cache")}" ${negated.has("cache")} ${negated.bool("verbose")} ${negated.has("verbose")}`)
  console.log(`${negations.parse(["--no-"]).message}`)
  console.log("arrays:")
  arrays(plain().parse(["--jobs=3", "--no-verbose", "--include", "a", "--include=b", "--output", "o"]))
  const nothing: string[] = []
  arrays(plain().parse(nothing))
  console.log("help:")
  const menu = new HelpMenu(new Style(false, true), "git-lite", 28, 30)
  menu.usage("<command> [flags]", "a small git")
  git().writeHelp(menu)
  console.log(menu.text())
  const bare = new HelpMenu(new Style(false, true), "tool", 28, 30)
  plain().writeHelp(bare)
  console.log(bare.text())
  return 0
}
