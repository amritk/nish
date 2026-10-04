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
| `<name>/` | a case of several files, for what the command line decides: which files are named and which may be rewritten. `argv` lists the files `--fix` is given; every `x.ts` comes out as its `x.fixed.ts`, or byte-identical when there is none; `exit` (default 0) is `--fix`'s status; `rewrites` (optional) counts the `fixed <file>` lines on stderr. A case that exits 0 must then compile clean, and one that does not must still report the fix it was not allowed to apply. With `same-as-plain`, the report instead has to be byte for byte what a plain run (human and `--json`) prints about the files `--fix` leaves. `node-modules/` is copied as `node_modules/`, which git would ignore here |

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

Two cases pin how the driver drops a fix that overlaps. `decl-fs-two-names`
imports two names from a missing `fs`, so two NL3015s carry the same edit of
the one specifier: the first is applied and the second dropped, in one round,
and the specifier is rewritten once. `decl-export-list-twice` is a fix whose
own edits overlap — `export { f, f }` asks for `export ` before `f` twice — so
it is dropped whole every round and the file is left as it was. Each fails when
its half of `acceptedEdits`'s overlap test is taken out.

A warning's fix cannot have a case of the plain forms yet: both need a plain
run that exits 1, which a program whose only diagnostics are warnings never
does, and `same-as-plain` compares the human report, where a plain run that
compiles prints `wrote <file>` and `--fix` does not. Until the runner grows a
warning-only form, a warning's case is a directory with a second root,
`seed.ts`, whose loose equality is an error with a fix of its own. The plain
run exits 1 on it; `--fix` fixes it in the first round, and a warning's fix is
applied only once the program checks, so the rounds after that apply the
warnings' fixes to `main.ts`, and the result must compile clean. A refused
shape is a `main.ts` with no `main.fixed.ts`, which `--fix` must leave
byte-identical, and each was checked by hand to report its warning with no
`fix` under a plain `--json` run of `main.ts` alone.

The `unsafe-index-` cases are that kind: every `argv` passes
`--unchecked-indexing`, and each fixed shape and each refused one in the
table in `docs/LANGUAGE.md` ("`nish:unsafe`") has its case.
`unsafe-index-rounds` pins the convergence its `rewrites` counts: every site's
fix carries the same import edit, so the first round over `main.ts` applies
one fix and the second the rest, after the round that fixes `seed.ts`.
`unsafe-index-equivalence`'s sources and their `.fixed.ts` are the two link
cases `tests/link/unsafe-migrate-index-flag` (under the flag) and
`unsafe-migrate-index-fixed` (without it), which print one `expected.out`.

A fix is behaviour-preserving or it is not attached. When a new fix is in
doubt about a shape, the shape gets a `.nofix.ts` case rather than a guess.
