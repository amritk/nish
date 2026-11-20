---
name: WP28 — compatibility mode
overview: --compat exists with six free-tier features; what is left is the library tier (Date, JSON, RegExp, Buffer) and the Tier 2 constructs that cost representation — function values, async, exceptions, generators and virtual dispatch. These decide how much unmodified TypeScript compiles.
roadmap: docs/roadmap/wp28-compatibility-mode.md
spec: docs/wp28-compatibility-mode.md
priority: 40
stages:
  - id: c-lib
    title: WP28 C-lib — Date, JSON, RegExp and Buffer under compat
    goal: Date objects, JSON, RegExp and Buffer compile under --compat under WP26's rules, each behind a compat feature entry, with the erasure invariant held.
    verification: node tests/run.js compat && npm run check && npm run lint
    status: pending
    todos:
      - id: clib-date
        content: Add a Date compat feature entry and its lowering over std — see WP28 C-lib
        status: pending
      - id: clib-json
        content: Add the JSON compat feature under WP26's rules in the compat allow-list — see WP28 C-lib
        status: pending
      - id: clib-regexp-buffer
        content: Add RegExp and Buffer compat features, each with a negative for the shape still refused — see WP28 C-lib
        status: pending
  - id: c2b-function-values
    title: WP28 C2b — function values with an environment and an indirect call
    goal: A function value whose target the checker cannot name compiles under --compat, with an indirect call and a captured-environment struct, and its cost is measured.
    verification: node tests/run.js compat && node tests/run.js performance && npm run lint
    status: pending
    todos:
      - id: c2b-indirect-call
        content: Lower an indirect call and a captured-environment struct under --compat in src/ — see WP28 C2b
        status: pending
      - id: c2b-escape
        content: Record the escape proof forfeited (WP6 cost, §7.4) and pin strict mode unchanged — see WP28 C2b
        status: pending
  - id: c3-async-sync
    title: WP28 C3 — async/await with --async-model sync
    goal: async/await compiles under --compat with the erasing lowering and §6.3's two rules, held by unmodified-Node cases.
    verification: node tests/run.js compat && node tests/run.js differential && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: c3-erasure
        content: Implement the erasure lowering and the Promise.all admission of §6.4 under --async-model sync — see WP28 C3
        status: pending
  - id: c4-async-threads
    title: WP28 C4 — --async-model threads, on scope()
    goal: --async-model threads lowers async functions onto scope() and forks Promise.all.
    verification: node tests/run.js compat && node tests/run.js threads && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: c4-threads
        content: Lower async onto scope() per §6.5 and choose which Promise.all to fork — see WP28 C4
        status: pending
  - id: c5-exceptions
    title: WP28 C5 — exceptions, try/catch
    goal: try/catch and throw compile under --compat using the lowering chosen from S6's measurements.
    verification: node tests/run.js compat && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: c5-lowering
        content: Implement try/catch under --compat with the chosen lowering, the Result desugaring being the spike's recommendation — see WP28 C5
        status: pending
  - id: c6-generators
    title: WP28 C6 — generators as iterators
    goal: Generators compile under --compat in the shape wp24 §3b describes.
    verification: node tests/run.js compat && npm run lint
    status: pending
    todos:
      - id: c6-generators-build
        content: Lower generators as iterators under --compat per wp24 §3b — see WP28 C6
        status: pending
  - id: c7-extends
    title: WP28 C7 — extends with virtual dispatch
    goal: extends with virtual dispatch compiles under --compat, reversing wp25 in compat only, landing on C2b's machinery.
    verification: node tests/run.js compat && npm run lint
    status: pending
    todos:
      - id: c7-virtual
        content: Add virtual dispatch for extends under --compat, built on C2b's indirect call — see WP28 C7
        status: pending
---

# WP28 — compatibility mode

## Context
Landed: spikes S1 to S6, C0 (the `--compat` flag, allow-list and `nish.compat`), C1 (optional parameters, `?.`, string `switch`, `for...of` over a string, overloads), and C2a with labelled `break`/`continue` built in strict. See [the roadmap page](../../docs/roadmap/wp28-compatibility-mode.md). Spec: [design note §7.3](../../docs/wp28-compatibility-mode.md#73-the-stages). Not planned: the dynamic Tier 3 constructs, a storable `Promise<T>`, running npm packages, compat inside `src/`, a flag per feature.

## WP28 C-lib — Date, JSON, RegExp and Buffer under compat
The library tier, under WP26's rules (`Map` and `Set` are strict already). Size L, and §4.1 says it outranks most of what follows. WP33's R6 is this package.
Likely files: `src/compat*.ts`, `std/`.

## WP28 C2b — function values with an environment and an indirect call
The expensive stage: spike S1 priced the call at 1.26x to 1.40x and what it does to WP6 at up to 8.76x ([§7.4](../../docs/wp28-compatibility-mode.md#74-s1-measured--and-the-headline-it-moves)). Strict mode must not change.

## WP28 C3 — async/await with --async-model sync
§6.3's two rules, the erasure, §6.4's admission, and unmodified-Node cases that hold it.

### Decision needed
Whether `async` belongs in compat or only `--async-model threads` (S2: 53.6% to 64.7% of four applications' async functions are async by contagion). Options: keep C3 (cheap, erasing), or retire it in favour of C4 alone. Spec: [§7.5](../../docs/wp28-compatibility-mode.md#75-s2-measured-async-by-contagion), [§10](../../docs/wp28-compatibility-mode.md#10-open).

## WP28 C4 — --async-model threads, on scope()
§6.5, on `scope()`, which is built. S4 priced the fork: break-even at a task of about 16 µs.

### Decision needed
How C4 picks the `Promise.all` to fork ([§7.7](../../docs/wp28-compatibility-mode.md#77-s4-measured-promiseall-as-a-forkjoin)). Options are recorded in §10; none is recommended there.

## WP28 C5 — exceptions, try/catch
Size L. 

### Decision needed
Which lowering: landing pads or a `Result` desugaring. S6 recommends the `Result` desugaring ([§7.9](../../docs/wp28-compatibility-mode.md#79-s6-measured-landing-pads-against-a-result-desugaring)).

## WP28 C6 — generators as iterators
wp24 §3b's shape. Size M.

## WP28 C7 — extends with virtual dispatch
wp25 reversed in compat only. It costs exactly what C2b costs and lands behind it. Open items also in §10: a per-dependency ceiling, whether `--compat` keeps implying `--number-mode f64`, and what the interop emitters do with a compat program.
