# `std/` — the standard library

Nish modules written in Nish, for Nish programs to import. There is no magic
here and nothing the compiler knows about: a module in this directory is an
ordinary Nish source file, compiled as part of whatever program imports it,
and subject to the same rules as `examples/` or `self/`
([`docs/LANGUAGE.md`](../docs/LANGUAGE.md) is the style guide).

| Module | What it is |
| --- | --- |
| [`testing.ts`](./testing.ts) | a test runner: a `Suite` a program drives with straight-line assertions, printing the `PASS` / `FAIL` / `SKIP` lines the repository's own harness prints, and answering the exit code |
| [`text.ts`](./text.ts) | the string operations a program would otherwise write inline: `splitLines`, `splitWhitespace`, `trim` and its halves, `contains`, `replaceAll`, and `firstDifference` over two arrays of lines |

## How a program imports it

By relative specifier, because that is the only import form the language has
(`Only relative import specifiers are supported`):

```ts
import { Suite } from "../std/testing";
```

**Source is the distribution format** ([`docs/wp21-packages.md`](../docs/wp21-packages.md)
§2), so an import of a `std/` module is not a link against a built library: the
module is compiled with the program that imports it, and the whole-program
attribute pass sees through it exactly as it sees through the program's own
functions. A `std/` function is inlined, specialised or dropped on the same
terms as a local one.

A bare specifier — `import { Suite } from "nish/testing"` — is what WP21 would
buy and is deliberately not faked in the meantime: a resolver that special-cased
this directory would be a second module system, and the one that is coming has
to agree with Node's.

`std/` is in the package's `files`, so an installed compiler has the library
beside it, and a program outside this repository reaches it by the path the
install put it at — `node_modules/nish/std/testing` for a local install. That
path is the honest form of "no resolution yet", and it is the one thing WP21
replaces first.

## Writing a module here

- **Spell the widths — and then convert what the builtins hand you.** `i32`,
  `i64`, `f64`, never `number`, so the module means the same thing under
  `--number-mode f64` as it does by default (`examples/arrays.ts` says that half
  for the same reason). It is necessary and **not sufficient**: `s.length`,
  `a.length` and `s.charCodeAt(i)` answer `number`, which *is* `f64` in that
  mode, so a module that declares every width of its own and still writes
  `let end: i32 = text.length` or `while (i < text.length)` does not compile
  there at all. Read each of those through `toI32` —
  `const length: i32 = toI32(text.length)`, once per function rather than once
  per iteration — and the module means one program in both modes. The default
  mode pays nothing for it, because `toI32` on an `i32` is identity.
  `tests/link/std_text_f64` is what keeps this from being prose;
  [`docs/wp26-stdlib.md`](../docs/wp26-stdlib.md) §4 is the reasoning.
- **Name the private helpers as though they were exported.** A function name is
  unique across the whole program whether or not it is exported, because the
  whole-program attribute analysis is keyed by symbol name — and a `std/` module
  is compiled *into* the program that imports it, so its private helpers are not
  private to the namespace. A helper called `isBlank` would stop any program that
  declares its own `isBlank` from compiling (`` Function `isBlank` is also
  defined in main.ts ``), which is why `text.ts` calls it `isTextBlankByte`. Keep
  the helpers few and their names distinctive; a module whose internals want
  `compare`, `next` or `parse` is asking for package-scoped symbols, which do not
  exist yet ([`docs/wp26-stdlib.md`](../docs/wp26-stdlib.md) §3e). Module
  constants are exempt — `NEWLINE` and `SPACE` fold at their uses, so a program
  may declare those names itself.
- **It is an Nish program**, so the constraints are the language's: a function is
  an arrow bound to a module-level `const`, a function is never a value, there
  are no generics, no `try` / `catch`, and no optional or default parameters.
  Those four are what shape an API here more than any style preference — see the
  header of `testing.ts` for what they did to that one.
- **Ship it with a `tests/link/` case.** `tests/link/<name>/` is the only place a
  multi-module program is exercised end to end, and it is also what puts the
  module into the corpus the stage1 oracles read
  ([`.claude/selfhost.md`](../.claude/selfhost.md)): a `std/` module with no
  importer in `tests/link/` is compiled by neither compiler on any run.
  `testing.ts` has two, one per outcome — `tests/link/std_testing` (exit 0) and
  `tests/link/std_testing_fail` (exit 1, and the wording of every failure
  message) — and `text.ts` has `tests/link/std_text`, which uses `Suite` to check
  it, the way a user would.
- **`std/` is not on the compiler's dependency list.** Nothing in `src/` or
  `self/` imports it, and nothing should: the compiler is the thing that has to
  build before the library means anything.

## What `std/testing` is not, and what closed

`std/testing` is a test *library*: it is how a compiled program checks itself.
Driving the compiler — compiling a corpus, assembling it, linking it, running it
and diffing stdout against a golden — needed three things the language did not
have, and all three have since landed as builtins:

| Was missing | Now |
| --- | --- |
| a directory listing | `readdirSync(path): string[] \| null`, sorted by bytes, because there is no `sort` for a caller to reach for |
| a child's **output** — `spawnSync` answers a status and nothing else | `spawnSyncTo(argv, stdoutPath, stderrPath)`, each stream to a file, an empty path inheriting |
| a clock | `monotonicNanos(): i64` |

So the driver exists, in the language, and it is
[`tests/nish/run.ts`](../tests/nish/run.ts): it discovers the golden cases with
`readdirSync`, compiles each one by spawning the compiler, links and runs the ones
with a `.out`, diffs the IR against the golden line by line, and reports through a
`Suite`. It passes over the whole corpus — `npm run test:nish` — and `npm test`
runs it over a handful of cases so that the three builtins are exercised together
on a real workload on every run.

It is still not a replacement for `tests/run.js`, and the difference is worth
being precise about: it covers section A, the golden cases, and none of the
pipeline checks — no interop sidecars, no layout assertions, no wasm profiles, no
packaging, no self-hosting oracles, and none of the fourteen flag variations
`tests/self/parity.js` runs. It also skips, by name and counted, the three
sidecars it does not implement (`.env`, `.argv`, `.stdout`). What it demonstrates
is that the language can host its own harness; what `tests/run.js` does is prove
the compiler.
