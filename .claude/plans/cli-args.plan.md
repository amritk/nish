---
name: Command-line parser for large generated CLIs (nish/cli-args) and ANSI colours on Style
overview: Add std/cli-args.ts, a declare-once command-tree parser that can replace Commander for generated API clients with hundreds of nested commands, its help generated with HelpMenu; and give std/cli.ts's Style a colour API (named ANSI colours, backgrounds, attributes, recolourable help roles) that follows the existing styleFor/agentDriven rules.
stages:
  - id: cli-colours
    title: "feat(cli) — ANSI colours and recolourable help roles on Style"
    goal: A program can paint any text in the 16 ANSI colours, backgrounds and attributes, and recolour HelpMenu's roles, with the same on/off policy styleFor already applies
    verification: npm run check && npm run lint && node tests/run.js std_cli
    todos:
      - id: colours-api
        content: Add the named colour, background and attribute painters and the raw sgr escape hatch to Style in std/cli.ts — see Stage 1 API
        status: pending
      - id: colours-roles
        content: Make Style's help roles (heading, name, flag, meta, dim) recolourable with defaults byte-identical to today — see Stage 1 Help roles
        status: pending
      - id: colours-tests
        content: Extend tests/link/std_cli with every painter under theme, mono and off, and a recoloured menu, pinned in expected.out — see Stage 1 Tests
        status: pending
      - id: colours-docs
        content: Document the colour API in the nish/cli section of the standard-library guide and the cli.ts row of std/README.md — see Stage 1 Docs
        status: pending
      - id: colours-goldens
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and confirm nish --help output is unchanged — see Stage 1 Freeze
        status: pending
  - id: cli-args
    title: "feat(cli) — nish/cli-args, a command-tree parser for large CLIs"
    goal: A program declares its command tree once with a builder, parse answers the matched command id and every value with its source, and a helper prints help, version or a one-line error and exits
    verification: npm run check && npm run lint && node tests/run.js std_cli_args
    todos:
      - id: args-declare
        content: Add std/cli-args.ts with the Cli builder (groups, leaf commands with ids, aliases, Commander-style flag specs, modifiers, positionals, epilogs) — see Stage 2 Declaring
        status: pending
      - id: args-parse
        content: Implement Cli.parse answering a ParseResult with every flag form, global flags at any position, local-flag scoping and positional rules — see Stage 2 Parsing
        status: pending
      - id: args-provenance
        content: Answer per-value provenance (argv, default, unset) on ParseResult — see Stage 2 Result
        status: pending
      - id: args-help
        content: Generate help for every level with HelpMenu (-h, --help, help path) and the version (-v, --version at the top) — see Stage 2 Help
        status: pending
      - id: args-errors
        content: Produce each error with its exact wording, did-you-mean by edit distance, and the separate print-and-exit helper — see Stage 2 Errors
        status: pending
      - id: args-tests
        content: Add tests/link/std_cli_args through std/testing covering every flag form, global positions, each error and exit code, pinned help text, and the 500-command tree — see Stage 2 Tests
        status: pending
      - id: args-example
        content: Add examples/api-cli, an API-client CLI with nested groups dispatching by switch on command id — see Stage 2 Example
        status: pending
      - id: args-docs
        content: Add the nish/cli-args section to the standard-library guide and its std/README.md row, with the follow-ups named — see Stage 2 Docs
        status: pending
---

# Command-line parser for large generated CLIs

## Context

[`std/cli.ts`](../../std/cli.ts) has `Style` (eight basic SGR colours, a monochrome failsafe, plain), `styleFor(fd, agent)` / `agentDriven()` (the colour policy), and `HelpMenu` (rows lined up in columns). It has no argument parser, so generated API clients (hundreds of nested commands, many flags each, JSON output) cannot move off Commander. Nish has no function values (no `.action(cb)`), no inheritance, no optional or default parameters, and no `try`/`catch`; it does have classes, `Map`, `process.argv`, `process.exit`, `console.error` and `panic`.

`std/cli.ts` is compiled by the seed as part of the compiler (`src/cli-style.ts` imports it relatively), so it is under the rolling freeze ([`.claude/selfhost.md`](../selfhost.md)). The parser therefore goes in a **new module, `std/cli-args.ts`**, which nothing in `src/` imports and which is free of the freeze. Stage 1 edits `std/cli.ts` and must use only what the last release compiles.

No open PR or issue covers this (searched 2026-10-28; #912 is the compiler's own `--sandbox` flag).

## Approach — a builder on a class, not a static table

**Chosen: a builder API on a `Cli` class that hands back integer handles, stored as flat arrays inside.** Why, against a static table the program declares:

- **No optional fields or parameters in Nish.** A table row must spell every column for every flag (short, meta, default, required, repeatable, negatable, description). Across hundreds of commands that is the bulk of the generated file. The builder takes the common shape in one call (`flag(cmd, "-r, --raw-output", "desc")`, Commander's own spec syntax, so a generator ports line for line) and the rare properties through modifier calls that only appear when used.
- **A table costs the same at startup anyway.** Nish has no compile-time constant data for arrays of objects; a table is built by running constructors at startup, the same work as builder calls.
- **Declarations are validated where they are written.** A duplicate name or a bad spec `panic`s naming the offending call, which a table checked in bulk would report far from its row.
- **Handles are `i32`, not objects**, so `main` dispatches with `switch (result.id)` on the id the program assigned, and a generator emits plain constants.

**Cost model.** Declaring is appends to flat arrays plus one `Map` insert per command name, alias and flag name (keyed `"<parent handle>\u0000<name>"`), so startup is linear in the declaration count and builds no strings beyond the keys. Parsing walks argv once with one map lookup per token: linear in argv, independent of tree size. Help text, did-you-mean (edit distance over one command's siblings or flags) and sorting run only on the help or error path.

## Stage 1 — `cli-colours`: ANSI colours on `Style`

**Owns:** `std/cli.ts`, `tests/link/std_cli/**`, the `## nish/cli` section of `docs/guide/using-nish/standard-library.md` (that section only), the `cli.ts` row of `std/README.md` (that row only), generated `tests/self/goldens/checked/**`.

### API

Methods on `Style`, each answering `text` wrapped in its SGR escape and a reset, or `text` unchanged when the style is off (`on` false); under the mono failsafe (`colour` false) a colour paints nothing and an attribute still paints.

| group | methods |
| --- | --- |
| foreground | `black` `red` `green` `yellow` `blue` `magenta` `cyan` `white`, and `brightBlack` (gray) … `brightWhite` |
| background | `bgBlack` … `bgWhite`, `bgBrightBlack` … `bgBrightWhite` |
| attributes | `bold` `faint` `italic` `underline` `inverse` `strikethrough` |
| raw | `sgr(text, codes)` paints with any SGR parameter list (`"1;31"`, `"38;5;208"`, `"38;2;255;128;0"`) when colour is on, nothing otherwise — the escape hatch for 256-colour and truecolor, which stay the caller's explicit choice |

Exported SGR code constants (`SGR_RED = "31"`, …, `SGR_BOLD = "1"`) so a caller composes `"1;31"` without magic strings. Combining is nesting or a joined code list; no chained builder objects.

### Help roles

`heading`, `name`, `flag`, `meta`, `dim` keep their names and today's codes as defaults. Add `setRole(role, themed, mono)` with exported role constants (`ROLE_HEADING` …), or one field pair per role — the worker picks the smaller, reads the same. The default output must be **byte-identical**: `tests/link/std_cli/expected.out`'s existing lines and `nish --help` do not move.

### Freeze

Only constructs the seed compiles (check with `bash scripts/fetch-seed.sh --force` then the bootstrap build). Regenerate `tests/self/goldens/checked/` with `node tests/self/goldens.js --update` and read the diff: only `std/cli.ts.txt` should move.

### Tests

Extend [`tests/link/std_cli/main.ts`](../../tests/link/std_cli/main.ts) and `expected.out`: every painter under theme, mono and off (escapes shown as `^[`), a recoloured `HelpMenu`, and the default menu unchanged. It also runs under Node (`cli-under-node` in `tests/run.js`), so it must print the same there.

### Docs

The `nish/cli` guide section gains a "Colours" part with one `nish:ok` example; the `std/README.md` `cli.ts` row names the painters, `sgr` and the roles.

## Stage 2 — `cli-args`: the parser

**Owns:** `std/cli-args.ts`, `tests/link/std_cli_args*/**`, `examples/api-cli/**`, the `std_cli_args` registrations in `tests/run.js` and `tests/shard-costs.json` (if the harness needs them), a new `## nish/cli-args` section of `docs/guide/using-nish/standard-library.md` (after `## nish/cli`, that section only), a new `cli-args.ts` row of `std/README.md`, and `llms.txt` if it lists std modules; generated `tests/self/goldens/checked/**`.

**Merge order:** after `cli-colours` (shared doc files, different sections). Development starts at once against `main`; it does not consume Stage 1's API.

### Declaring

```ts
import { Cli, ROOT, PARSE_OK, finish } from "nish/cli-args"
import { agentDriven, styleFor } from "nish/cli"

const CMD_USERS_LIST: i32 = 1
const cli = new Cli("api", "1.4.0", "Talk to the Example API")
const baseUrl = cli.globalFlag("--base-url <url>", "API base URL")
cli.defaultValue(baseUrl, "https://api.example.com")
const raw = cli.globalFlag("-r, --raw-output", "print JSON as it arrives")
const users = cli.group(ROOT, "users", "Manage users")
const keys = cli.group(users, "keys", "Manage a user's API keys")
const list = cli.command(keys, "list", CMD_USERS_LIST, "List a user's keys")
cli.alias(list, "ls")
const userId = cli.argument(list, "<user-id>", "the user")
const limit = cli.flag(list, "-l, --limit <n>", "at most n keys")
const tag = cli.flag(list, "--tag <tag>", "filter by tag (repeatable)")
cli.repeatable(tag)
cli.epilog(list, "Examples:\n  api users keys list 42 --limit 5")

export const main = (): i32 => {
  const r = cli.parse(process.argv, 1)
  if (r.kind !== PARSE_OK) {
    return finish(r, styleFor(1, agentDriven()), styleFor(2, agentDriven()))
  }
  switch (r.id) {
    case CMD_USERS_LIST:
      return listKeys(r.positional(userId), r.value(limit), r.values(tag), r.flag(raw))
  }
  return 0
}
```

- `group(parent, name, description)` and `command(parent, name, id, description)` answer a command handle; `ROOT` is the root. Depth is unbounded. `alias(handle, name)` adds another name for a command or group.
- Flag specs are Commander's: `"--name"` (boolean), `"--name <value>"` (required value), `"--name [value]"` (optional value), `"-r, --raw-output"` (short alias), `"--no-color"` (declares `color`, default true). Modifiers: `defaultValue(f, v)`, `required(f)`, `repeatable(f)`, `negatable(f)` (adds `--no-x` to a boolean `--x`).
- `globalFlag(spec, desc)` declares once; it is accepted at the root and at every depth, before or after any verb. `flag(cmd, spec, desc)` is local to that one command.
- `argument(cmd, spec, desc)`: `"<name>"` required, `"[name]"` optional, `"<name...>"` / `"[name...]"` variadic, last only.
- `epilog(handle, text)`: free-form text printed after the generated help (examples, auth notes).
- A declaration mistake — duplicate name in one scope, a local flag shadowing a global, `-h`/`-v` taken, a positional after a variadic, a required positional after an optional, a bad spec — `panic`s naming the call. Generated code is static, so this fires on the first run of a bad generator, never on user input.

### Parsing

`parse(argv, start)` reads `argv[start ..]` once, left to right:

- Tokens that name a child of the current command (or its alias) descend while the current command is a group and no positional has been taken.
- Flags resolve against the current command's local flags, then the globals. A flag local to a command not yet reached, or to another command, is an unknown flag.
- `--name=value`; `--name value` where a required value is taken **even when it starts with `-`**; `--name [value]` takes the next token only when it does not start with `-`; `-abc` sets three booleans; in a cluster, a short flag that takes a value takes the rest of the cluster (`-l5`) or the next token; `--no-x` for a negatable boolean; `--` ends flag parsing and every later token is positional.
- A boolean given `=value` is an error. A non-repeatable flag given twice keeps the last value (Commander's rule); a repeatable one gathers every value in order.
- After the walk: a group reached with no subcommand, a missing required flag, a missing required positional, or an excess positional is an error.
- `-h`/`--help` anywhere (before `--`) answers the help of the deepest command reached; `help <path>` at the root answers that path's help; `-v`/`--version` answers the version only at the root (elsewhere it is an unknown flag).

### Result

`ParseResult` is a plain object — nothing prints or exits during `parse`:

| member | meaning |
| --- | --- |
| `kind` | `PARSE_OK`, `PARSE_HELP`, `PARSE_VERSION`, `PARSE_ERROR` |
| `command`, `id`, `path` | the command handle reached, the program's id for a leaf (`-1` for a group), and its path (`"api users keys list"`) |
| `flag(f)` | a boolean's value (default applied) |
| `value(f)` | `string \| null`, last value or default |
| `values(f)` | `string[]`, every value in argv order (empty when none) |
| `source(f)` | `SOURCE_ARGV`, `SOURCE_DEFAULT` or `SOURCE_UNSET` — tells an explicit `--base-url` from a defaulted one |
| `positional(a)`, `positionals(a)` | a positional's value, or a variadic's values |
| `rest()` | the tokens after `--` |
| `message` | the one-line error, for `PARSE_ERROR` |
| `help(style)` | the help text for `command`, built on demand with `HelpMenu` |
| `exitCode` | 0 for help and version, 2 for an error, 0 for OK |

`finish(r, out, err)` is the only thing that prints: help or version on stdout and `process.exit(0)`; an error's line and hint on stderr and `process.exit(2)`. A test inspects `r` and never calls it.

### Help

Built with `HelpMenu` and the caller's `Style` (so `styleFor`/`agentDriven` decide colour; plain when piped, `NO_COLOR`, or an agent):

```text
api 1.4.0  Talk to the Example API

usage: api users keys list <user-id> [flags]   List a user's keys

Arguments
  <user-id>               the user

Flags
  -l, --limit <n>         at most n keys
  --tag <tag>             filter by tag (repeatable)
  -h, --help              show help

Global flags
  --base-url <url>        API base URL (default: https://api.example.com)
  -r, --raw-output        print JSON as it arrives

Examples:
  api users keys list 42 --limit 5
```

A group's help lists `Commands` (name, aliases, description) instead of `Arguments`; the root's adds `-v, --version`. Columns come from the longest row in that menu, capped so descriptions start by column 32. Required flags say `(required)`.

### Errors

Exactly two lines on stderr, then exit 2. The first names the command path; the second is the hint:

| case | first line |
| --- | --- |
| unknown flag | `api users keys list: unknown flag --limt (did you mean --limit?)` |
| unknown command | `api users: unknown command 'kyes' (did you mean 'keys'?)` |
| missing command | `api users: missing command (one of: keys, list)` |
| missing value | `api users keys list: --limit needs a value` |
| value on a boolean | `api: --raw-output takes no value` |
| missing required flag | `api users keys list: missing required flag --org` |
| missing positional | `api users keys list: missing argument <user-id>` |
| excess positional | `api users keys list: unexpected argument 'extra'` |

Hint: `Run 'api users keys list --help' for usage.` The suggestion appears only when the closest candidate is within edit distance 2 (or a third of the name's length, whichever is larger); otherwise the parenthesis is left off. Error text is never painted.

### Tests

Through [`std/testing`](../../std/testing.ts) (`Suite`), as `tests/link/std_cli_args/main.ts` with `expected.out` and `expected.code`, mirroring [`tests/link/std_cli`](../../tests/link/std_cli/main.ts):

- Every flag form in **Parsing**, each with its value and `source`.
- A global flag before the first verb, between verbs, and after the leaf at depth 3; a local flag on a sibling command refused.
- Each error row's exact message and `exitCode` 2; help and version `exitCode` 0.
- Help for the root, a group and a leaf, plain, pinned in `expected.out` as golden text.
- A tree of **500 generated commands** (for example 20 groups × 25 leaves, 8 flags each): declare it, parse the last leaf's argv 10,000 times, check the id and values, and check the time against a generous wall-clock bound (10× the measured figure); report the measured figure in the PR body.
- A second small program (`tests/link/std_cli_args_exit/`) that calls `finish` on an error, so its `expected.code` pins exit 2 and the stderr wording through the real exit path.

### Example

`examples/api-cli/main.ts` — a fake API client: `users list|get|keys list|keys create`, `projects list`, globals `--base-url`, `--token`, `-r, --raw-output`, `--output json|table`, a mutually exclusive check that uses `source` (`--base-url` explicit together with `--profile`), dispatch by `switch` on ids, JSON on stdout. Builds with `build/nish examples/api-cli/main.ts --link build/api-cli`, with `// smoke:` lines if the examples harness reads them.

### Docs

`## nish/cli-args` in the standard-library guide (after `## nish/cli`): the builder-vs-table decision in two sentences, a `nish:ok` example, the flag-form table, the result table, the error wording, and **follow-ups**: shell completion, man-page generation, and moving `nish`'s own CLI onto it once a release ships the module (the rolling freeze). `std/README.md` gets the row.

## Out of scope

- Shell completion and man-page generation (follow-ups).
- Migrating `nish`'s own CLI in `src/` (rolling freeze; follow-up after the release that ships `std/cli-args.ts`).
- Environment-variable fallbacks for flags, config files, interactive prompts, subcommand-specific `--version`.

## Pre-flight

| check | result |
| --- | --- |
| stages complete | both have goal, runnable verification, Owns, todos |
| Owns resolve | `std/cli.ts`, `tests/link/std_cli/**`, the two doc files and the goldens exist; `std/cli-args.ts`, `tests/link/std_cli_args*/**`, `examples/api-cli/**` are new |
| disjoint | shared files: `docs/guide/using-nish/standard-library.md` and `std/README.md` (disjoint sections; `cli-args` merges second and resolves any textual conflict when it takes `main`), `tests/self/goldens/checked/**` (generated, regenerated never hand-merged) |
| dependency graph | `cli-args` merges after `cli-colours`; acyclic |

## Verification

Per stage, before the PR: `npm run check`, `npm run lint`, `node tests/run.js <stage filter>` (`std_cli`, `std_cli_args`), the docs-snippet filter that compiles `standard-library.md`'s `nish:ok` blocks, `node tests/self/goldens.js --update` with the diff read. Full suite is CI's four shards.
