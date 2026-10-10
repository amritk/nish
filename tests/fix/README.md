# Machine-applicable fixes

One case per fix a diagnostic carries, and one per shape that is refused a
fix, run by the "Machine-applicable fixes" block of `tests/run.js`
(`node tests/run.js fix`). The `fix` field and `nish --fix` are described in
[`AGENTS.md`](../../AGENTS.md#machine-readable-surfaces).

| Files | What the runner asserts |
| --- | --- |
| `<name>.ts` and `<name>.fixed.ts` | `--json` on the input reports at least one diagnostic with a `fix`; `nish --fix` on a copy of it exits 0 and leaves exactly the bytes of `<name>.fixed.ts`; and `<name>.fixed.ts` compiles with `--json`, exit 0 and no error object |
| `<name>.rounds` (optional) | how many rounds `--fix` takes: one `fixed <file>` line on stderr per round that rewrote the file |
| `<name>.nofix.ts` | `--json` reports at least one diagnostic and none of them has a `fix` key; `nish --fix` on a copy exits as the plain compile does and leaves the file byte-identical |
| `<name>.plain-exit` (optional) | the plain `--json` run's exit status, for either form above, default 1; a program whose only diagnostics are warnings exits 0 |
| `<name>.code` (optional) | a code the plain `--json` run must report, so a case whose diagnostic stopped firing fails rather than passing with nothing to fix; beside a `.fixed.ts`, the fixed program must no longer report it |
| `<name>.stdout` (optional) | beside a `.fixed.ts`: the input and the fixed program are each linked and run, and both must print exactly this and exit with `<name>.run-exit` (default 0). Skipped without clang |
| `<name>/` | a case of several files, for what the command line decides: which files are named and which may be rewritten. `argv` lists the files `--fix` is given; every `x.ts` comes out as its `x.fixed.ts`, or byte-identical when there is none; `exit` (default 0) is `--fix`'s status; `rewrites` (optional) counts the `fixed <file>` lines on stderr. A case that exits 0 must then compile clean, and one that does not must still report the fix it was not allowed to apply. With `same-as-plain`, the report instead has to be byte for byte what a plain run (human and `--json`) prints about the files `--fix` leaves. `plain-exit` and `code` are the sidecars above, checked on the plain run (on the run after `--fix` under `same-as-plain`), and `code` is checked absent from the fixed program when `--fix` exits 0. `node-modules/` is copied as `node_modules/`, which git would ignore here |

A case is named in kebab-case for the family of rule it fixes — `eq-` for
loose equality, `expr-` for the expression checker's fixes, `decl-` for the
declaration and module passes, `unsafe-index-` for the `--unchecked-indexing`
migration (NL7002) — and a refused shape has `nofix` in its name.
Every fix and every shape that is refused one has a case here: there is no
line coverage for Nish, so this directory is the coverage gate.

The directory cases pin the driver in `src/fix.ts`: `eq-two-roots` (every
named root is loaded each round, even after one is refused), `eq-named-twice`
(a file named twice is rewritten once), `eq-import-not-named` (a fixable
module that is imported but not named is left alone) and `eq-package-named`
(a dependency is left alone even when it is named), `eq-unfixable-first`
(a root after a refused one is still fixed, but the report stops where a plain
run's stops) and `eq-missing-roots` (with two missing roots, the report names
the first, as a plain run does). Each was checked by
reverting the behaviour it pins and watching it fail.

Two cases pin how the driver drops a fix that overlaps. `guard-two-receivers`
has two NL9007s in one statement whose guards insert at the same offset: the
first is applied and the second dropped as overlapping it, and the next round
applies the other, so it takes two rounds. `decl-export-list-twice` is a fix
whose own edits overlap — `export { f, f }` asks for `export ` before `f` twice
— so it is dropped whole every round and the file is left as it was. Each fails
when its half of `acceptedEdits`'s overlap test is taken out. An edit
identical to one already accepted is not an overlap but the same change, made
once: the `unsafe-index-` directory cases' fixes share one import edit, and
`unsafe-index-rounds` and `unsafe-index-pair` count the single round that
takes; each needs more rounds when `sameAsAny` is taken out.
`decl-fs-two-names` pinned the first half until #434: two names from a
missing `fs` are one NL3015 now, not two carrying the same edit.

The `guard-` cases are NL9007's, whose fix is a guard
before the statement that ends in `panic`, which the bounds analysis credits.
A fixed program compiles with no diagnostic left that carries a fix, which is
what keeps a guard the analysis did not credit from being inserted again every
round, and each fixed case's `code` is NL9007, which the fixed program must no
longer report. `guard-array` and `guard-out-of-range` run the program before and after
the fix: the same output in range, and status 1 out of range, from the
runtime's index error before and from the guard's panic after. A `u8`, `u16`
or `u32` index gets the upper end alone, `toU32(i) < toU32(xs.length)`, whose
type is its lower end (`guard-u8`, `guard-u16`, which runs out of range, and
`guard-u32`). Each refused shape — an `i64` or `u64` index (`toU32` would keep
a `u64`'s low bits), an access in a loop's condition or behind `? :`, `&&` or
`??`, a call before it in the statement, a statement that declares the index,
a `panic`, `toI32` or `toU32` the module declares, as a function, a parameter
or a local — has a case, and each fails when its refusal in `boundsGuardEdits`
(`src/checker.ts`) is taken out. `guard-nofix-deny-panics` pins the last
refused shape: under `--deny-panics` the index is an error (NL2457), so the
program does not check and no warning's fix is applied.

Before `plain-exit`, a warning's fix could not have a case of the plain forms:
both needed a plain run that exits 1, which a program whose only diagnostics
are warnings never does, and `same-as-plain` compares the human report, where
a plain run that compiles prints `wrote <file>` and `--fix` does not. So a
warning's case was written as a directory with a second root, `seed.ts`,
whose loose equality is an error with a fix of its own. The plain run exits 1
on it; `--fix` fixes it in the first round, and a warning's fix is
applied only once the program checks, so the rounds after that apply the
warnings' fixes to `main.ts`, and the result must compile clean. A refused
shape is a `main.ts` with no `main.fixed.ts`, which `--fix` must leave
byte-identical. The runner cannot tell that it was reported at all — the
seed's fix satisfies its first check alone — so each refused shape's warning
is pinned, reason and all, by a `tests/wordings` case of its own: a build
that stops reporting the warning fails every one of those pins.

The `unsafe-index-` cases are that kind: every `argv` passes
`--unchecked-indexing`, and each fixed shape and each refused one in the
table in `docs/LANGUAGE.md` ("`nish:unsafe`") has its case.
`unsafe-index-rounds` pins the convergence its `rewrites` counts: every site's
fix carries the same import edit, and one round over `main.ts` applies them
all, after the round that fixes `seed.ts`. `unsafe-index-pair` is #461's
`a[at[0]] + b[at[1]]`: `uncheckedGet` is a load to the bounds analysis, so
rewriting `a[at[0]]` leaves `at[1]` proven and both sites land in that one
round. `unsafe-index-kept` is an access the build without the flag proves
from a check the migration leaves in place (`names[i]`, whose strings have no
`nish:unsafe` form): it is not a site, and stays `xs[i]`.
`unsafe-index-equivalence`'s sources and their `.fixed.ts` are the two link
cases `tests/link/unsafe-migrate-index-flag` (under the flag) and
`unsafe-migrate-index-fixed` (without it), which print one `expected.out`.
Its four modules hold every fixed shape, so each rewrite is compiled and run
without the flag; the fix runner itself compiles the result with the case's
`argv`, flag included.

A fix is behaviour-preserving or it is not attached. When a new fix is in
doubt about a shape, the shape gets a `.nofix.ts` case rather than a guess.
