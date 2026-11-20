# WP51: References to capture-free top-level functions

**State:** In progress · **Open work:** [#1892](https://github.com/amritk/nish/issues/1892) · **Design note:** [`docs/wp51-function-references.md`](https://github.com/amritk/nish/blob/main/docs/wp51-function-references.md)

## Stages

- [x] Designed and measured: dispatch, the escape proof, the tag check, sets to 32 members and leaks
- [x] Stage 1: references in fields, locals, arrays and returns; calls; `===`; per-place sets; the escape-join refusal; the debug-build tag check
- [x] Stage 2: references as arguments, `| null` and `Map` values

## Open work

Open stages are the sub-issues of [#1892](https://github.com/amritk/nish/issues/1892), one pull request each, specified in [`.claude/plans/wp51-function-references.plan.md`](https://github.com/amritk/nish/blob/main/.claude/plans/wp51-function-references.plan.md). What waits on a decision is labelled `needs-decision` there.

## Not planned

Closures, `Function`, and references across the C ABI.

[All work packages](index.md)
