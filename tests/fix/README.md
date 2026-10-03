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

A case is named for the family of rule it fixes — `eq_` for loose equality,
`expr_` for the expression checker's fixes, `decl_` for the declaration and
module passes — and a refused shape has `nofix` in its name. Every fix and
every shape that is refused one has a case here: there is no line coverage
for Nish, so this directory is the coverage gate.

A fix is behaviour-preserving or it is not attached. When a new fix is in
doubt about a shape, the shape gets a `.nofix.ts` case rather than a guess.
