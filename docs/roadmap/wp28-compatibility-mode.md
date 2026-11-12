# WP28: Compatibility mode

**State:** Proposed · **Done:** 2 of 13 · **Design note:** [`docs/wp28-compatibility-mode.md`](https://github.com/amritk/nish/blob/main/docs/wp28-compatibility-mode.md)

## Stages

- [x] Spike S1: the function-value tier priced (a call 1.26x to 1.40x, escape analysis 8.76x)
- [x] A statically known callee (C2a) and labelled `break`/`continue`, built in strict with no flag
- [ ] Spike S2: count the `async` functions that await something blocking, on a real application
- [ ] Spikes S3 to S6: the erasure corpus, `Promise.all` against `parallelReduce`, the cost of `--number-mode f64`, lowering `try`/`catch`
- [ ] C0: the `--compat` flag, its allow-list and `nish.compat`, with no feature
- [ ] C1: optional parameters, `?.`, string `switch`, `for...of` over a string, overloads
- [ ] C-lib: `Date`, `JSON`, `RegExp` and `Buffer` under compat
- [ ] C2b: function values with an environment and an indirect call
- [ ] C3: `async`/`await` with `--async-model sync`
- [ ] C4: `--async-model threads`, on `scope()`
- [ ] C5: exceptions, `try`/`catch`
- [ ] C6: generators as iterators
- [ ] C7: `extends` with virtual dispatch

## Next

Waiting on the proposal's acceptance and the questions of its §10. WP33's R6 is this package; R5's review tier, the stage before it, is built.

## Waiting on a decision

Whether to accept compatibility mode, and its open questions: whether `async` belongs in it, a per-dependency ceiling, what the interop emitters do with a compat program. Spec: [§7.3 The stages](https://github.com/amritk/nish/blob/main/docs/wp28-compatibility-mode.md#73-the-stages), [§10 Open](https://github.com/amritk/nish/blob/main/docs/wp28-compatibility-mode.md#10-open).

## Not planned

The dynamic Tier 3 constructs, a storable `Promise<T>`, running npm packages, compat inside `src/`, a flag per feature.

[All work packages](index.md)
