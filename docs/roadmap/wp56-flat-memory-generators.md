# WP56: Generators whose memory stays flat: a string builder, and a scope per file

**State:** Proposed · **Open work:** [#1926](https://github.com/amritk/nish/issues/1926) · **Design note:** [`docs/wp56-flat-memory-generators.md`](https://github.com/amritk/nish/blob/main/docs/wp56-flat-memory-generators.md)

## Open work

Open stages are the sub-issues of [#1926](https://github.com/amritk/nish/issues/1926), one pull request each, specified in [`.claude/plans/wp56-flat-memory-generators.plan.md`](https://github.com/amritk/nish/blob/main/.claude/plans/wp56-flat-memory-generators.plan.md). What waits on a decision is labelled `needs-decision` there.

## Not planned

A rope `string`, appending in place to the arena, a collector. Deferred: S5's analysis for parallel bodies and `scope()` tasks.

[All work packages](index.md)
