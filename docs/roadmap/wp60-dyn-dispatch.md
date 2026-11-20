# WP60: Dynamic dispatch over interfaces

**State:** Proposed · **Open work:** [#1872](https://github.com/amritk/nish/issues/1872) · **Design note:** [`docs/wp60-dyn-dispatch.md`](https://github.com/amritk/nish/blob/main/docs/wp60-dyn-dispatch.md)

## Stages

- [x] Designed and measured: `Dyn<I>`, a tag and a pointer, a call lowered to a per-place `switch` of direct calls, against the hand-written dispatch; recommends shipping stage 1 now, with stages 2 and 3 each gated on its own build's timing (neither passes on the note's figures yet)

## Open work

Open stages are the sub-issues of [#1872](https://github.com/amritk/nish/issues/1872), one pull request each, specified in [`.claude/plans/wp60-dyn-dispatch.plan.md`](https://github.com/amritk/nish/blob/main/.claude/plans/wp60-dyn-dispatch.plan.md). What waits on a decision is labelled `needs-decision` there.

## Not planned

Class inheritance, `abstract`, interface `extends`, default methods, a vtable, a tag header in every object, a `Dyn` across the C ABI.

[All work packages](index.md)
