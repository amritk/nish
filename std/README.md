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

By its package specifier:

```ts
import { Suite } from "nish/testing";
```

`nish/<module>` resolves to `<module>.ts` in this directory, found beside the
compiler that is running — not relative to the importing file, so the same
specifier works at any depth and from outside this repository.

**Source is the distribution format** ([`docs/wp21-packages.md`](../docs/wp21-packages.md)
§2), so an import of a `std/` module is not a link against a built library: the
module is compiled with the program that imports it, and the whole-program
attribute pass sees through it exactly as it sees through the program's own
functions. A `std/` function is inlined, specialised or dropped on the same
terms as a local one — and a module you import but never call is dropped
whole. Measured at the `speed` and `size` profiles, both of which link with
`-flto -Wl,--gc-sections`: a program importing three `std/text` functions and
calling none is **byte-identical** to the same program without the import.
(`debug` keeps them, which is what `debug` is for.)

A `std/` module is its own package (`nish`), so its symbols are scoped and a
program may declare a function one of these modules also exports
(`tests/link/std_package_scope`, `docs/wp21-packages.md` §5a). The package is
decided by the `nish/` specifier rather than by the directory the file is found
in — read off the path it would be `nish` from `node_modules/nish/std/` and the
root package from a checkout, and the same program would compile against an
installed compiler and be refused by a checkout of it.

A relative specifier still works and means the same thing —
`import { Suite } from "../std/testing"` — but it hard-codes the depth of the
importing file and only reaches an installed library by the path the install
put it at, so `nish/` is the form to write.

### Why this is not the second module system this file used to warn about

An earlier version of this section said a bare specifier was "deliberately not
faked", because a resolver that special-cased this directory would be a second
module system and the one WP21 is bringing has to agree with Node's. That
reasoning still holds for third-party packages, which are still refused
(`docs/wp21-packages.md` §5b). It does not hold for *this* package, for two
reasons that are only true of it:

- There is exactly one right answer. `std/` ships inside the compiler's own
  package and is versioned with it, so "the `std/` beside this binary" is not a
  guess a resolver makes — it is the only `std/` that can be correct for the
  compiler reading it. No version can be skewed against it.
- It **is** what Node resolves. `package.json` declares
  `"./*": "./std/*.ts"` in `exports`, so `nish/text` is a package
  self-reference: `import.meta.resolve("nish/text")` answers `std/text.ts`, and
  `tsc` under `moduleResolution: node16` resolves it to the same file, which is
  what gives an editor go-to-definition into the real source. The compiler
  short-circuits to that answer rather than walking `node_modules` to reach it.

So this is WP21's first slice rather than a detour around it: the spelling is
the one WP21 specifies, and what is still missing is resolution for specifiers
that are *not* this package.

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
