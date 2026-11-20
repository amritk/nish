# WP57: Module-scoped names

**State:** In progress · **Open work:** [#1871](https://github.com/amritk/nish/issues/1871) · **Design note:** [`docs/wp57-module-scoped-names.md`](https://github.com/amritk/nish/blob/main/docs/wp57-module-scoped-names.md)

## Stages

- [x] S1: a private function's or generic template's symbol qualified by its module path when it would clash, with the clash checks over the qualified symbols
- [x] S2: exported names that clash inside one package: decided, they stay refused, and nothing is built
- [x] S3a: a struct's symbol in the type table, separate from its source name and equal to it

## Open work

Open stages are the sub-issues of [#1871](https://github.com/amritk/nish/issues/1871), one pull request each, specified in [`.claude/plans/wp57-module-scoped-names.plan.md`](https://github.com/amritk/nish/blob/main/.claude/plans/wp57-module-scoped-names.plan.md). What waits on a decision is labelled `needs-decision` there.

## Not planned

Versions in a symbol's identity, qualifying every symbol whether or not it clashes.

[All work packages](index.md)
