# WP28: Compatibility mode

**State:** In progress · **Done:** 6 of 13 · **Design note:** [`docs/wp28-compatibility-mode.md`](https://github.com/amritk/nish/blob/main/docs/wp28-compatibility-mode.md)

## Stages

- [x] Spike S1: the function-value tier priced (a call 1.26x to 1.40x, escape analysis 8.76x)
- [x] A statically known callee (C2a) and labelled `break`/`continue`, built in strict with no flag
- [x] Spike S2: the `async` functions of four real applications counted (53.6% to 64.7% are `async` by contagion; two applications are above half by under a point)
- [x] Spikes S3 to S6: a bare `--compat` held to the erasure invariant over the corpus, `Promise.all` as a fork/join against `parallelReduce` (break-even at a task of about 16 µs), the cost of `--number-mode f64` (20 of 34 benchmark programs refused as written), landing pads against a `Result` desugaring for `try`/`catch`
- [x] C0: the `--compat` flag, its allow-list and `nish.compat`, with no feature
- [x] C1: optional parameters, `?.`, string `switch`, `for...of` over a string, overloads
- [ ] C-lib: `Date`, `JSON`, `RegExp` and `Buffer` under compat
- [ ] C2b: function values with an environment and an indirect call
- [ ] C3: `async`/`await` with `--async-model sync`
- [ ] C4: `--async-model threads`, on `scope()`
- [ ] C5: exceptions, `try`/`catch`
- [ ] C6: generators as iterators
- [ ] C7: `extends` with virtual dispatch

## Next

C-lib: the library tier, `Date` objects, `JSON`, `RegExp` and `Buffer` under compat, under WP26's rules (`Map` and `Set` are strict already). C1 built the free tier: `optional-params` (an `x?: T` read through `??`, and defaults that run per call) and `overloads` (signatures checked and lifted, a call no signature takes refused) joined `nullish`, `optional-chaining`, `string-switch` and `for-of-string`, so `--compat` now has six features. WP33's R6 is this package. Spec: [§7.3 The stages](https://github.com/amritk/nish/blob/main/docs/wp28-compatibility-mode.md#73-the-stages).

## Open questions

The questions the spikes measured and did not settle: whether `async` belongs in compat or only `--async-model threads` (S2), whether `--compat` keeps implying `--number-mode f64`, as C0 built it (S5), which lowering C5 uses (S6 recommends the `Result` desugaring), and how C4 picks the `Promise.all` to fork (S4). Also a per-dependency ceiling, and what the interop emitters do with a compat program. None of them blocks C1. Spec: [§10 Open](https://github.com/amritk/nish/blob/main/docs/wp28-compatibility-mode.md#10-open), [§7.5 to §7.9](https://github.com/amritk/nish/blob/main/docs/wp28-compatibility-mode.md#75-s2-measured-async-by-contagion).

## Not planned

The dynamic Tier 3 constructs, a storable `Promise<T>`, running npm packages, compat inside `src/`, a flag per feature.

[All work packages](index.md)
