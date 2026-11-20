# WP28: Compatibility mode

**State:** In progress · **Open work:** [#1907](https://github.com/amritk/nish/issues/1907) · **Design note:** [`docs/wp28-compatibility-mode.md`](https://github.com/amritk/nish/blob/main/docs/wp28-compatibility-mode.md)

## Stages

- [x] Spike S1: the function-value tier priced (a call 1.26x to 1.40x, escape analysis 8.76x)
- [x] A statically known callee (C2a) and labelled `break`/`continue`, built in strict with no flag
- [x] Spike S2: the `async` functions of four real applications counted (53.6% to 64.7% are `async` by contagion; two applications are above half by under a point)
- [x] Spikes S3 to S6: a bare `--compat` held to the erasure invariant over the corpus, `Promise.all` as a fork/join against `parallelReduce` (break-even at a task of about 16 µs), the cost of `--number-mode f64` (20 of 34 benchmark programs refused as written), landing pads against a `Result` desugaring for `try`/`catch`
- [x] C0: the `--compat` flag, its allow-list and `nish.compat`, with no feature
- [x] C1: optional parameters, `?.`, string `switch`, `for...of` over a string, overloads

## Open work

Open stages are the sub-issues of [#1907](https://github.com/amritk/nish/issues/1907), one pull request each, specified in [`.claude/plans/wp28-compatibility-mode.plan.md`](https://github.com/amritk/nish/blob/main/.claude/plans/wp28-compatibility-mode.plan.md). What waits on a decision is labelled `needs-decision` there.

## Not planned

The dynamic Tier 3 constructs, a storable `Promise<T>`, running npm packages, compat inside `src/`, a flag per feature.

[All work packages](index.md)
