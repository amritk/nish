---
name: WP51 stage 2 — references as arguments, `| null` and `Map` values
overview: Admit a function reference in the three places stage 1 left refused — as the argument to a function-typed parameter (one `$fn.ref.<set>` instantiation per set), as `S | null` with tag 0 (the function-type exception to `reject_nullable_scalar`, and zero-filled `new Array<S | null>(n)`), and as a `Map` value (lifting NL2738, arrays-of-reference values included). Each new place joins the per-place pass, gets a `fnref_place_set` variant, and is covered by the escape-join refusal. A reference argument to `expose`, `exposeWith`, `parallelMapInto` and `parallelReduce` stays refused until their readers handle a dispatcher. Folds in the stage 1 follow-ups of #1417. Design source docs/wp51-function-references.md §2.1–§2.3, §6 and §9 item 2; stage 1 is #1404 (74d3b915).
stages:
  - id: stage2
    title: "feat(checker): function references as arguments, `| null` and `Map` values (WP51 stage 2)"
    goal: A reference-typed local, field or element passes to a function-typed parameter, a reference can be `null`, and a `Map` can hold references — each compiled to a `switch` dispatcher over its place's set with no indirect call, each refused where the escape join or a dispatcher-blind reader would make it unsound, and every stage 1 follow-up from #1417 closed.
    verification: npm run check && npm run lint && node tests/run.js fnref && node tests/run.js reject_fnref && node tests/run.js reject_fnarg && node tests/run.js wordings && node tests/run.js emit-ts && node tests/run.js debug && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi (skip line read) && node tests/self/goldens.js && node tests/differential/goldens.js && node tests/nish-cmp.js && node scripts/gen-reference.mjs --check && node docs/check-links.mjs
    status: pending
    todos:
      - id: follow-ups-1417
        content: "Close #1417 first, as decided at sign-off: pin `f < g` / `f + 1` on a reference and naming a function with a defaulted parameter (NL2729's default branch) with a test each, decide `JSON.stringify(f)`'s wording as signed off, settle the debugger step as signed off, and reword docs/LANGUAGE.md's `nish:` builtin note (≈8259) that still says no function is a value — see Follow-ups"
        status: pending
      - id: args-instantiation
        content: "Admit a reference-typed local, member or element as the argument to an inline function-typed parameter: the call selects one `$fn.ref.<set>` instantiation per distinct set, whose slot in `Instantiation.functionArgs` holds the set's generated dispatcher (a checked function with facts), and whose call through the parameter lowers to that dispatcher. NL2734 (`nl2734_fnref_to_function_parameter`) flips — see Arguments"
        status: pending
      - id: args-not-name
        content: "Flip `reject_fnarg_not_name` (docs/LANGUAGE.md ≈3398–3402): rewrite the test to an expression of a non-function type, which stays refused, and the rule text with it — see Arguments"
        status: pending
      - id: args-dispatcher-readers
        content: "Refuse a reference argument to `expose`, `exposeWith`, `parallelMapInto` and `parallelReduce` with a new NL code each (or one code naming the callee), each with a negative test and a tests/wordings program, and admit it everywhere else; audit every reader of `functionArgs` named in §9 item 2 (src/region-rules.ts, src/secret.ts, src/parallel.ts, src/inline-arrays.ts) so none treats a dispatcher slot as \"no callee\" — see Arguments"
        status: pending
      - id: args-arrow-capture
        content: "An arrow inside a `$fn.ref.<set>` instantiation (or any function) that captures a reference parameter resolves to the host's place, so its call dispatches over the set the host's callers feed — stage 1's round-2 B4 class; test it for each new place — see Arguments"
        status: pending
      - id: nullable
        content: "Admit `S | null` for a function type S as the exception to `reject_nullable_scalar`: tag 0 is null, `=== null` / `!== null` and narrowing work, a call is admitted only on the narrowed type, `new Array<S | null>(n)` is admitted and zero-filled, `new Array<S>(n)` and module storage stay refused, `| null` on any other scalar stays refused — see Null"
        status: pending
      - id: map-values
        content: "Admit `Map<K, S>`, `Map<K, S[]>` and `Map<K, S | null>` values (lift NL2738, retire it in tests/wordings/unreachable.txt; flip `reject_fnref_map`, `reject_fnref_map_array`, `reject_fnref_map_nullable` to positives or to the refusal that remains); a function type as a `Map` key stays refused — see Map"
        status: pending
      - id: per-place-pass
        content: "Extend the per-place pass (src/fnrefs.ts) to each new place — a parameter fed by arguments, a nullable place, a `Map`'s value place and the arrays held as values — with the store-context rows for each (`set`, an argument, `?? ` and `?:` into a nullable place), and keep the escape-join refusal reading `pointerParam(...).outlives` / `escaping` through every new place, with a negative per place (case B through an argument, through `| null`, through a `Map`) — see Places"
        status: pending
      - id: place-set-variants
        content: "Add `fnref_place_set` variants — the reference passed as an argument, through `| null`, through a `Map` value — each a golden `.ll` pinning the dispatcher over `{u0, u1, u2}` plus `u3` where the variant stores it, `P` an `alloca`, peak RSS equal at 1x and 10x as `fnref_place_set` is — see Places"
        status: pending
      - id: emit-ts-debug
        content: "Each new positive case runs under `--emit-ts` with the same stdout (register with node tests/differential/goldens.js --update; regenerate tests/differential/emit-ts-known.txt only under CI's pinned Node), and `-g` keeps the enumeration type for a nullable reference (tag 0 named `null`) — see Semantics"
        status: pending
      - id: docs
        content: "docs/LANGUAGE.md rules for arguments, `| null` and `Map` values with test citations; the function-reference guide page and docs/guide/language/functions.md; the cookbook entry for a `$fn.ref.<set>` instantiation; §6's stage-2 rows of docs/wp51-function-references.md marked done; tick stage 2 in docs/roadmap/wp51-function-references.md and its index row; regenerate docs/reference and the self goldens; nish-cmp DECLARED entries for every moved IR"
        status: pending
---

# WP51 stage 2 — references as arguments, `| null` and `Map` values

The spec is [`docs/wp51-function-references.md`](../../docs/wp51-function-references.md)
§9 item 2, with §2.1 (what is admitted), §2.2 (what stays refused), §2.3 (the
lowering, the per-place pass and the store-context table) and §6 (the rows
stage 2 breaks: `src/generics.ts` ≈2048, `docs/LANGUAGE.md:3398`–`3402`).
Stage 1 landed as #1404 (74d3b915); read its diff for the shape of the per-place
pass, the dispatcher generation and the escape-join refusal before writing
anything.

One stage, one PR, as §9 requires: the three places all extend the same
per-place pass in `src/fnrefs.ts`, the same codes in `src/codes.ts` and the same
`docs/LANGUAGE.md` sections, so splitting them would give three PRs that
conflict on every file.

## stage2

**Owns:** `src/**`, `std/**`, `tests/**`, `docs/**`, `scalar.config.json`,
`.claude/*.md`

Not owned, on purpose: `.github/workflows/**`, `knip.json`, lint and coverage
configuration. A change there is a sensitive path the merge gate escalates; if
the stage cannot be done without one, say so in the PR body instead of making
it.

### Follow-ups (#1417)

Take these first; they are small and they settle wordings the rest of the stage
builds on. The owner's decisions from sign-off are recorded in the tracking
issue's Run section — follow them exactly:

- `<` / `>` / arithmetic on a reference: today NL2100 / NL2231. Pin both with a
  test whatever the wording decision.
- Naming a function with a defaulted parameter: NL2729's default branch
  (`src/fnrefs.ts` ≈42–44) has no test. Add `tests/wordings/nl2729_fnref_default`
  or a `tests/cases/reject_fnref_default`.
- `JSON.stringify(f)`: NL2244 (unknown builtin) today.
- Debugger step: gdb's first `step` stops in the line-0 `$ref.*` dispatcher
  (`tests/run.js` ≈3810–3815).
- `docs/LANGUAGE.md` ≈8259–8260: reword the stale reason.

The seed note at the end of #1417 (`fetch-seed.sh` serving a stale cache) is
out of scope; run `bash scripts/fetch-seed.sh --force` before nish-cmp.

### Arguments

A reference-typed local, member or element passed to an inline function-typed
parameter selects `$fn.ref.<set>`: one instantiation per distinct set, the
parameter's slot in `Instantiation.functionArgs` holding the set's dispatcher —
never an empty list, because every reader treats any length but one as "no
callee" and would let a region, a parallel body or an `expose` through
unchecked (§9 item 2 lists them: `src/region-rules.ts` ≈981,
`src/secret.ts` ≈2716/2094/2477, `src/parallel.ts` ≈323/1192,
`src/inline-arrays.ts` ≈757 — re-find the lines on `main`). `src/secret.ts`'s
`paramNames[1]` reads the callee's parameter list, and on a dispatcher parameter
`i + 1` is the member's `i`; until that and the parallel roles' grain and
capture walks are taught the dispatcher, refuse a reference argument to
`expose`, `exposeWith`, `parallelMapInto` and `parallelReduce`, one negative
each.

Stage 1's lesson (#1390 round 2, B4): an arrow that captures a reference
parameter must resolve to the host's place, or its call dispatches over the
wrong set and traps. Test that shape inside a `$fn.ref.<set>` instantiation.

### Null

§2.1's new rule: `S | null` for a function type S is the one exception to
`reject_nullable_scalar`; tag 0 is `null`, so zero-filled storage reads as
`null`. `new Array<S | null>(n)` is admitted; `new Array<S>(n)` (NL2520's shape)
and module storage stay refused. Keep a negative for `i32 | null`.

### Map

Stage 1 refuses a reference as a `Map` value with NL2738 (`reject_fnref_map`,
`reject_fnref_map_array`, `reject_fnref_map_nullable`). Lift it for `S`, `S[]`
and `S | null` values; a `Map` key of function type stays refused (§2.2).

### Places

Each new place is a place of the per-place pass: a function-typed parameter fed
by its callers' arguments, a nullable local/field/element, a `Map`'s value
place, and an array held as a `Map` value. Every store context that can reach
one gets a row test in the style of stage 1's `fnref_row_*`, so the golden shows
`u3` in the place's set. The escape-join refusal keeps reading
`pointerParam(...).outlives` / `escaping` and covers each new place, with case
B's program written through each.

`fnref_place_set` gains three variants: argument, `| null`, `Map`. Each pins the
dispatcher over its set with A's facts and `P` an `alloca`, and runs at 10x its
loop length with peak RSS pinned equal, as the stage 1 program does.

### Semantics

`--emit-ts` is reading A (§5.1): references are the JS functions themselves, so
`null` is `null` and a `Map` holds functions. Each positive case runs under Node
with identical stdout. `-g`'s enumeration type for a nullable reference names
tag 0 `null` (§5.3).

### Before each push

- Merge `main` (`npm run sync-main`) and renumber any NL code `main` took in
  the meantime, right before the push — stage 1 conflicted twice on
  `src/codes.ts`.
- CI's eight shards are the full run; locally run the verification line.
