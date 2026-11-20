# WP21: Packages

**State:** In progress · **Open work:** [#1911](https://github.com/amritk/nish/issues/1911) · **Design note:** [`docs/wp21-packages.md`](https://github.com/amritk/nish/blob/main/docs/wp21-packages.md)

## Stages

- [x] S1: package-scoped symbols ([#57](https://github.com/amritk/nish/pull/57))
- [x] S2: bare specifiers and the `nish` export condition
- [x] S3: resolution diagnostics and package identity, a module is its real path
- [x] S3: an error naming the package when a builtin has no runtime on the target (`readFileSync` on wasm)
- [x] S3: a compile error inside `node_modules/<pkg>` attributed to that dependency

## Open work

Open stages are the sub-issues of [#1911](https://github.com/amritk/nish/issues/1911), one pull request each, specified in [`.claude/plans/wp21-packages.plan.md`](https://github.com/amritk/nish/blob/main/.claude/plans/wp21-packages.plan.md). What waits on a decision is labelled `needs-decision` there.

## Not planned

Diamond dependencies and two copies of one package, a separate resolver tool.

[All work packages](index.md)
