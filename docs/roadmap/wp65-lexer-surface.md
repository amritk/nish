# WP65: The surface a lexer port asked for

**State:** Proposed · **Open work:** [#1884](https://github.com/amritk/nish/issues/1884) · **Design note:** [`docs/wp65-lexer-surface.md`](https://github.com/amritk/nish/blob/main/docs/wp65-lexer-surface.md)

## Stages

- [x] Array module constants for a byte-class table: built before this package as [constant tables](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#constant-tables) (`const CLASS: readonly u8[] = [...]`); the docs that show them to a lexer author land with S1

## Open work

Open stages are the sub-issues of [#1884](https://github.com/amritk/nish/issues/1884), one pull request each, specified in [`.claude/plans/wp65-lexer-surface.plan.md`](https://github.com/amritk/nish/blob/main/.claude/plans/wp65-lexer-surface.plan.md). What waits on a decision is labelled `needs-decision` there.

## Not planned

An array whose `length` covers uninitialised slots; `memchr` for elements wider than a byte; `toString` on arrays or classes.

[All work packages](index.md)
