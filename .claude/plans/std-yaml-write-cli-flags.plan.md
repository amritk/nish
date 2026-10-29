---
name: YAML writer and flag parser for std
overview: Two standard-library additions for command-line programs — a YAML writer that serialises a nish/json-value document and reads back unchanged through nish/yaml, and a declared-table flag parser beside HelpMenu whose usage errors exit 2. Each ships with its tests and its guide section.
stages:
  - id: yaml-writer
    title: "feat(std): write a JSON value as YAML (nish/yaml-write)"
    goal: A JsonDocument value becomes YAML text that parseYaml reads back as the same tree, with every ambiguous string quoted
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js std_yaml && node docs/check-links.mjs
    todos:
      - id: yaml-write-module
        content: Add std/yaml-write.ts with stringifyYaml(doc, value) and its writer — see Stage yaml-writer → API and layout
        status: pending
      - id: yaml-write-quoting
        content: Implement the quoting rule (core-schema look-alikes, YAML 1.1 booleans, indicators, colon-space, space-hash, edge spaces, empty, control characters) — see Stage yaml-writer → Quoting
        status: pending
      - id: yaml-write-unit-tests
        content: Add tests/link/std_yaml_write with per-rule cases, keys and values, and the hand-picked documents — see Stage yaml-writer → Tests
        status: pending
      - id: yaml-write-round-trip
        content: Add the yaml-test-suite round trip (JSON to YAML to parseYaml equals the JSON) with a pinned pass count — see Stage yaml-writer → Tests
        status: pending
      - id: yaml-write-docs
        content: Document it in the nish/yaml section of standard-library.md and a std/README.md row, then regenerate goldens — see Stage yaml-writer → Docs
        status: pending
  - id: cli-flags
    title: "feat(std): parse command-line flags from a declared table (nish/cli-flags)"
    goal: A program declares its flags as data, parses argv into typed values, positionals and a subcommand path, and a usage error exits 2
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js std_cli && node docs/check-links.mjs
    todos:
      - id: flags-table
        content: Add std/cli-flags.ts with the declared flag table (string, number, boolean, repeatable) and subcommand paths, no function values — see Stage cli-flags → API
        status: pending
      - id: flags-parse
        content: Implement parse over string[] for --flag value, --flag=value, --no-flag, --, positionals and the subcommand path — see Stage cli-flags → Grammar
        status: pending
      - id: flags-usage-errors
        content: Report usage errors as data plus a helper that prints to stderr and exits 2 — see Stage cli-flags → Usage errors
        status: pending
      - id: flags-help-rows
        content: Let the table write its rows into a HelpMenu so help and parser share one declaration — see Stage cli-flags → API
        status: pending
      - id: flags-tests
        content: Add tests/link/std_cli_flags (positive run) and negative programs exiting 2 with expected stderr — see Stage cli-flags → Tests
        status: pending
      - id: flags-docs
        content: Document it in the nish/cli section of standard-library.md and a std/README.md row, then regenerate goldens — see Stage cli-flags → Docs
        status: pending
---

# YAML writer and flag parser for std

Two independent additions, one PR each, run in parallel. Neither touches
`src/`, and neither is a language construct, so the construct checklist
(`docs/ARCHITECTURE.md` → "How to add a construct") does not apply. Both are
user-visible `std/` modules, so each updates its `docs/guide/` section in the
same PR (`CLAUDE.md` → "The user guide moves with the language").

Neither reads the network, the terminal or another process, so neither needs a
`docs/security/` record (`scripts/security-scope.mjs` covers `std/net`,
`std/crypto` and `runtime/*.c`). The flag parser's exit helper calls
`process.exit`; that is the `process` capability and nothing else.

## Shared files and merge order

Both stages add a section to `docs/guide/using-nish/standard-library.md` (its
module table near the top, and the `nish/yaml` section at about line 689 vs the
`nish/cli` section at about line 938) and one row to `std/README.md`. Each
stage edits **only its own rows and its own section**: the hunks are hundreds
of lines apart and merge without conflict. `cli-flags` merges second, after it
brings `main` in. `tests/self/goldens/checked/**` is generated: each stage
regenerates it, never hand-merges it.

## Stage yaml-writer

**Owns:** `std/yaml-write.ts` (new), `tests/link/std_yaml_write/**` (new),
`tests/link/std_yaml_conformance/**`, `docs/guide/using-nish/standard-library.md`
(the module-table row for `nish/yaml` and the `## nish/yaml` section only),
`std/README.md` (a new `yaml-write.ts` row only),
`tests/self/goldens/checked/**` (generated).

### API and layout

A new module `nish/yaml-write`, not an addition to `std/yaml.ts`: the parser
must not depend on `nish/json-value`, and a program that only reads YAML should
not compile a writer. Shape (the worker may refine names to match the repo):

    import { JsonDocument } from "nish/json-value"
    import { stringifyYaml } from "nish/yaml-write"

    const text: string = stringifyYaml(doc, root)   // block style, 2-space indent, trailing newline

- Block mappings and block sequences; `{}` and `[]` for empty ones; key order
  kept as the document holds it.
- Numbers written as their source text (`numberText`), which the core schema
  resolves as int or float — check `1e2`, `-0`, `18446744073709551616`; any
  JSON number text that would not resolve as a number under the core schema is
  a bug to find with a test, not to assume away.
- `null`, `true`, `false` written plain.
- Depth is bounded the way `nish/json-value` bounds it; a document the parser's
  default `maxDepth` would refuse is either refused by the writer with a stated
  answer or documented — decide and test it.

### Quoting

A string is written plain only when `parseYaml` would read the plain scalar
back as **the same string of type string**. Otherwise double-quoted with JSON-
style escapes (`\"`, `\\`, `\n`, `\t`, `\u00XX` for other C0 controls and DEL,
`\x85`/` `/` ` escaped). Quoted at least:

- anything the core schema resolves as null, bool, int or float (`null`, `Null`,
  `~`, empty, `true`, `False`, `1`, `-1`, `0x1F`, `0o17`, `1e3`, `.inf`,
  `-.Inf`, `.nan`), and the YAML 1.1 booleans and null look-alikes a 1.1 reader
  would turn (`yes`, `no`, `on`, `off`, `y`, `n` in any case);
- a leading indicator: `@`, `` ` ``, `*`, `&`, `!`, `|`, `>`, `%`, `'`, `"`,
  `#`, `,`, `[`, `]`, `{`, `}`, and `-`, `?`, `:` when followed by a space or
  at the end;
- containing `: ` or ` #`, or ending in `:`;
- leading or trailing whitespace, a line break, a tab, any control character,
  a BOM, or `---` / `...` at the start;
- every key, under the same rule as a value.

The rule is checked the strong way too: a test writes each case, parses it,
and asserts the scalar's `type` is `YAML_STRING` and its `text` is the input.

### Tests

- `tests/link/std_yaml_write/` (`main.ts`, `expected.out`, `expected.code` 0):
  every quoting case above as a key and as a value, the exact text written for a
  few hand-picked documents (nested map in seq in map, empties, numbers, unicode),
  and a negative or two (whatever the writer refuses).
- Round trip over `tests/yaml-suite/cases.txt`: for each case with a JSON
  expectation, parse the JSON into a `JsonDocument`, `stringifyYaml` it, parse
  the result with `parseYaml`, and compare with the existing `YcComparer`
  (`tests/link/std_yaml_conformance/compare.ts`). Every case passes or is an
  expected failure with its reason; pin the pass count like
  `YC_PINNED_PASSES`. Put it where the comparer lives (a mode or a second
  program) — the worker picks, and the program runs under
  `node tests/run.js std_yaml`.
- Show the exact LLVM IR only if the stage adds a `tests/cases/*.ts` snippet;
  it should not need one.

### Docs

A subsection of `## nish/yaml` in `docs/guide/using-nish/standard-library.md`
("Writing YAML") with a runnable example and the quoting rule in one paragraph;
the module-table row mentions `nish/yaml-write`; a `std/README.md` row. Then
`node tests/self/goldens.js --update` and read the diff.

## Stage cli-flags

**Owns:** `std/cli-flags.ts` (new), `tests/link/std_cli_flags*/**` (new),
`docs/guide/using-nish/standard-library.md` (the module-table row for
`nish/cli` and the `## nish/cli` section only), `std/README.md` (a new
`cli-flags.ts` row only), `tests/self/goldens/checked/**` (generated).

### API

A new module `nish/cli-flags` beside `nish/cli`, not in `std/cli.ts`:
`std/cli.ts` is imported by the compiler through a relative path, so anything
added there is compiled into `nish` itself under the rolling freeze. The new
module imports `HelpMenu` from `nish/cli`.

No function values anywhere: the program declares the table as data and asks
the result for values by name. Shape (the worker may refine names):

    const flags = new FlagTable("git-lite")
    flags.command("remote add", "<name> <url>", "add a remote")   // a subcommand path
    flags.string("output", "<file>", "where to write")
    flags.number("jobs", "<n>", "parallel jobs")
    flags.boolean("verbose", "say more")
    flags.repeatable("include", "<dir>", "search here too")
    const got = flags.parse(args)                // args: string[], no argv[0]
    if (!got.ok) { got.exitUsage() }             // stderr, exit 2
    got.command      // "remote add", or "" at the top level
    got.str("output") / got.num("jobs") / got.bool("verbose") / got.all("include")
    got.has("output") / got.positionals
    flags.writeHelp(menu)                        // rows into a HelpMenu

Decide and document: what `num` holds (`f64`, or `i64` with a separate float
kind), defaults, and whether a flag can be scoped to one subcommand. Keep it
to what the requirements name; short flags (`-v`) are out of scope.

### Grammar

- `--name value` and `--name=value` for string, number and repeatable flags;
  `--name=` is the empty string.
- `--name` sets a boolean true and `--no-name` sets it false; `--name=value` on
  a boolean is a usage error (or accepts `true`/`false` — decide, test).
- A repeatable flag collects every occurrence in order; a non-repeatable one
  given twice is a usage error.
- `--` ends flags; everything after it is positional, including `--x`.
- A lone `-` is positional.
- The subcommand path is the longest declared command matched by the leading
  non-flag words; the rest are positionals.

### Usage errors

Unknown flag, missing value, a value that is not a number for a number flag,
a repeated non-repeatable flag, a value on a boolean, and an unknown
subcommand when commands are declared and none matched. The result carries
the error as data (message, the offending argument); `exitUsage()` prints
`<program>: <message>` and a one-line usage hint to stderr and exits **2**.

### Tests

- `tests/link/std_cli_flags/` — every grammar rule above with its parsed
  result printed, `expected.code` 0.
- At least two negative programs (`tests/link/std_cli_flags_bad_*`) with
  `expected.code` 2 and `expected.stderr`.

### Docs

A subsection of `## nish/cli` ("Parsing flags") with a runnable example and
the grammar; the module-table row mentions `nish/cli-flags`; a `std/README.md`
row. Then `node tests/self/goldens.js --update` and read the diff.

## Acceptance criteria

1. A Nish program that builds a `JsonDocument` holding null, both booleans,
   integers, a 20-digit integer, `1e2`, strings, nested arrays and objects and
   empty `{}`/`[]` writes it as YAML, and `parseYaml` reads that text back with
   no diagnostics and the same tree — kinds, core-schema types, decoded text,
   key order.
2. Each of `yes no on off y n true false null ~ 1 0x1F 1e3 .inf -.nan`, a
   string starting with `@`, `*`, `&`, `!`, `|`, `>`, `%`, `-`, `?`, `[` or
   `{`, one containing `: ` or ` #`, one with edge spaces, the empty string
   and one with a newline or control character, written as a key and as a
   value, reads back as a string equal to the input.
3. Every yaml-test-suite case with a JSON expectation round-trips JSON → YAML →
   `parseYaml` to the same JSON (or is a listed expected failure with a
   reason), and the program runs under `node tests/run.js std_yaml`.
4. A program declares string, number, boolean and repeatable flags and a
   two-word subcommand with no function values, and for one argv gets the
   right values from `--flag value`, `--flag=value`, `--no-flag`, repeated
   flags, `--` and positionals.
5. Each usage error (unknown flag, missing value, non-numeric number, unknown
   subcommand) prints a message on stderr and the process exits with status 2;
   a good parse exits 0.
6. `docs/guide/using-nish/standard-library.md` shows both with a runnable
   example, `std/README.md` lists both modules, and `node docs/check-links.mjs`
   passes.
7. Every CI `test` shard is green on `main` after both merge.

## Amendment (2026-10-29T00:40Z, during the run)

The plan missed one shared file. `src/std-modules.ts`'s `stdModuleNames`
literal lists every `std/` module, and `tests/run.js` fails when it disagrees
with the files under `std/`, so both stages must add their module's name to
that one line (sorted): `yaml-write` and `cli-flags`. Both stages now own
**that literal only** in `src/std-modules.ts`. The two edits conflict on the
same line by construction; `cli-flags` merges second and resolves it when it
syncs `main` (keep both names, in sorted order). Because the file is in
`src/`, each PR also runs `node tests/run.js wasi` (with `WASI_SYSROOT=/usr`,
reading its skip line) and `node tests/run.js performance` before it pushes,
and regenerates `tests/self/goldens/checked/` (`CLAUDE.md`).

## Amendment 2 (2026-10-29T00:56Z)

A new `std/` module also has to appear in each of the three `for f in ...`
presence lists in `.github/workflows/release.yml` (`tests/run.js`'s "release.yml's
3 presence gates each name every std module" check). Each stage owns its own
module's entry in those three lists and nothing else in the file; `cli-flags`
resolves the same-line conflict at sync. Whether a PR that touches a workflow
file may merge without a human is a merge-gate question put to the user.
