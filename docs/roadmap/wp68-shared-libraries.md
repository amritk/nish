# WP68: Shared libraries, layered like atomic design

**State:** Proposed · **Open work:** [#1868](https://github.com/amritk/nish/issues/1868) · **Design note:** [`docs/wp68-shared-libraries.md`](https://github.com/amritk/nish/blob/main/docs/wp68-shared-libraries.md)

## Stages

- [x] S1: the survey of duplicated helpers, the benches that time the copies each cluster's bench names (§4.3 lists the rest), the tiers (atoms, molecules, organisms, pages) and their import rule (this note)

## Open work

Open stages are the sub-issues of [#1868](https://github.com/amritk/nish/issues/1868), one pull request each, specified in [`.claude/plans/wp68-shared-libraries.plan.md`](https://github.com/amritk/nish/blob/main/.claude/plans/wp68-shared-libraries.plan.md). What waits on a decision is labelled `needs-decision` there.

## Not planned

Moving or renaming a public `std/` module, folding `std/bytes.ts` into the atoms directory, and sharing code between `runtime/*.c` and Nish.

[All work packages](index.md)
