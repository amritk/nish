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
declaration and module passes — and a refused shape has `nofix` in its name.
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

**Not pinned here yet: dropping an overlapping fix.** Every loose-equality
fix is one edit on its own operator token, so two can never overlap, and
`acceptedEdits`'s overlap branch (and `overlapsAny`'s two edits at one
offset) is unreachable from this stage's fixes. The decl-fixes stage, whose
fixes carry more than one edit, must pin it with a case of its own.

A fix is behaviour-preserving or it is not attached. When a new fix is in
doubt about a shape, the shape gets a `.nofix.ts` case rather than a guess.
