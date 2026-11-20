# WP61: Typed JSON, constraints and coercion in one pass

**State:** Proposed · **Open work:** [#1869](https://github.com/amritk/nish/issues/1869) · **Design note:** [`docs/wp61-json-typed-checks.md`](https://github.com/amritk/nish/blob/main/docs/wp61-json-typed-checks.md)

## Open work

Open stages are the sub-issues of [#1869](https://github.com/amritk/nish/issues/1869), one pull request each, specified in [`.claude/plans/wp61-json-typed-checks.plan.md`](https://github.com/amritk/nish/blob/main/.claude/plans/wp61-json-typed-checks.plan.md). What waits on a decision is labelled `needs-decision` there.

## Not planned

Generating classes from a schema (that is WP62), a runtime schema interpreter, validating a `JsonDocument` against a schema, any second pass, coercing a union field that is not `| null`, and reading past a limit or a syntax error.

[All work packages](index.md)
