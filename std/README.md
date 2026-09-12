# `std/` — the standard library

Nish modules written in Nish, for Nish programs to import. There is no magic
here and nothing the compiler knows about: a module in this directory is an
ordinary Nish source file, compiled as part of whatever program imports it,
and subject to the same rules as `examples/` or `self/`
([`docs/LANGUAGE.md`](../docs/LANGUAGE.md) is the style guide).

| Module | What it is |
| --- | --- |
| [`testing.ts`](./testing.ts) | a test runner: a `Suite` a program drives with straight-line assertions, printing the `PASS` / `FAIL` / `SKIP` lines the repository's own harness prints, and answering the exit code |

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

- **Spell the widths.** `i32`, `i64`, `f64`, never `number`, so the module means
  the same thing under `--number-mode f64` as it does by default. `examples/arrays.ts`
  says the same thing for the same reason.
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
  message).
- **`std/` is not on the compiler's dependency list.** Nothing in `src/` or
  `self/` imports it, and nothing should: the compiler is the thing that has to
  build before the library means anything.

## What `std/testing` is not

It is a test *library*, not a replacement for `tests/run.js`. The Node harness
compiles the corpus, assembles it with `llvm-as`, links it, runs it and diffs
stdout against a golden, and three of those need something the language does not
have yet:

| Missing | Why the harness needs it |
| --- | --- |
| a directory listing (`readdirSync`) | `tests/cases/` is discovered, not listed in a manifest. Today a Nish driver would have to read a checked-in list of its cases |
| a child's **output** (`spawnSync` answers an exit status and nothing else) | comparing a program's stdout with its `.out` is the whole of a golden run. A driver can redirect through `sh -c` into a file and read that back, which is a shell dependency the harness does not have |
| a clock | `tests/run.js` reports how long a section took; nothing in the language can read the time |

Those are three builtins and a design decision each, not a work package that is
underway. Until they land, the split is the honest one: the Node harness drives
the compiler, and `std/testing` is how a compiled program checks itself.
