---
name: A reassigned let leaves no memory behind
overview: A `let` holding a Result (or another stackable value) that is assigned again today sends every one of its sites to the arena and, through the assignment's LEAKS flow, takes the function's arena scope away, so a handler called from an event loop keeps about 1 KB per request and neither the retention warnings nor --deny-retention say so. Stage 1 makes the escape analysis follow the local's own flow on an assignment, so such a function keeps its scope and a site whose value cannot outlive the call goes on the stack. Stage 2 makes what still stays in the arena loud: Ok/Err count as visible allocations for NL9003/NL9016, and a new retention warning names a function that keeps per-call memory no scope releases, so --deny-retention catches it.
stages:
  - id: let-reassign-scope
    title: "fix(codegen): a reassigned let no longer keeps its values in the arena"
    goal: A function whose `let` holding a Result is assigned again keeps its arena scope (or puts the sites on the stack), so calling it in a loop or event loop leaves Arena.used() flat; every aliasing, capture, return and store case stays sound
    verification: npm run check && npm run lint && node tests/run.js res_ && node tests/run.js result && node tests/run.js mem_ && node tests/run.js arena && node tests/run.js memory && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/nish-cmp.js
    status: pending
    todos:
      - id: assign-follows-local
        content: In src/escape.ts useOutcome/classifyUse path (escape.ts ~838, attributes.ts ~1262), make an assignment `x = <site>` into a local follow localOutcome(x) instead of an unconditional FLOW_LEAKS, so allocLeaks and the escapes/contained propagation (attributes.ts ~4907, 5666, 5804) no longer fire for a local that never leaves the call — see Stage 1
        status: pending
      - id: per-site-stack
        content: Where a reassigned let's flow is local, give each stackable site (Ok/Err, by-value Result call) its own entry-block alloca instead of refusing on `stable` (escape.ts ~1347, ~1512); where it is not (aliased, in a loop with an older reader, captured, returned, stored), keep the arena — see Stage 1
        status: pending
      - id: soundness-tests
        content: Native round-trip cases (.ts + .out, golden .ll) for the user's shape, the pointer-Result-from-a-call shape, and every unsound neighbour (const old = r before the reassignment, capture in a closure, return of r, push of r into an outer array, reassignment inside a loop read after it); an Arena.used()-flat check over 100k calls — see Stage 1, Tests
        status: pending
      - id: docs-memory-model
        content: Rewrite docs/LANGUAGE.md Memory model item 1 and the known-gap line, docs/wp6-memory.md "Left out", docs/guide/language/memory.md and the IR cookbook entry if it moves — see Stage 1, Docs
        status: pending
      - id: goldens-cmp
        content: Regenerate tests/self/goldens (goldens.js --update), tests/differential goldens and docs/cookbook (regen.sh), and add narrow DECLARED entries to tests/nish-cmp.js for every corpus program whose IR moves — see Verification
        status: pending
  - id: retention-warn
    title: "feat(checker): warn when a function keeps per-call memory no scope releases"
    goal: What still stays in the arena after stage 1 is reported — Ok/Err count as visible allocations for NL9003/NL9016, and a new NL90xx retention warning names a function whose per-call allocations are kept with no scope to release them when it is reached from a loop pass; --deny-retention turns it into NL2462
    verification: npm run check && npm run lint && node scripts/gen-diagnostic-codes.mjs --check && node tests/run.js retention && node tests/run.js perf_arena && node tests/run.js codes && node tests/run.js wordings && node tests/run.js performance && WASI_SYSROOT=/usr node tests/run.js wasi && node scripts/gen-reference.mjs --check && node tests/nish-cmp.js
    status: pending
    todos:
      - id: ok-err-visible
        content: Make perfAllocatesVisibly (src/checker.ts ~2854) count an Ok(..)/Err(..) whose payload is boxed, so NL9003 (reassigned arena local) and NL9016 (pass drop) fire on the Result shapes; check the perfIsPointerType bail-out fits — see Stage 2
        status: pending
      - id: kept-memory-rule
        content: A new warning, next free NL9018 in src/codes.ts performanceRules, raised from the escape facts (allocLeaks / no arena scope, the explain-memory "keeps what it allocates" finding) for a root-package function reached from a loop pass that cannot scope, naming the first allocation line; add it to isRetentionCode (src/compilation.ts ~386) — see Stage 2
        status: pending
      - id: warn-tests
        content: tests/wordings/nl9018_*, perf_* positive and quiet cases (the const shape and stage 1's stacked shape stay quiet), reject_deny_retention_* for the new code, and the performance gate over std/ and src/ stays clean — see Stage 2, Tests
        status: pending
      - id: warn-docs
        content: docs/LANGUAGE.md retention rules and "Retention as an error", docs/guide/language/memory.md, regenerated docs/reference (gen-reference.mjs) and the diagnostics page — see Stage 2, Docs
        status: pending
      - id: goldens-warn
        content: Regenerate tests/self/goldens and any generated reference pages; DECLARED entries if IR moves — see Verification
        status: pending
---

# A reassigned let leaves no memory behind

## Requirements, as given

> A memory leak the compiler doesn't catch. A let variable holding a Result
> that gets reassigned is allocated on the arena on every call. Inside a
> server's event loop that memory is never released: about 1 KB per /feed, and
> throughput dropped as it grew. Neither the retention warnings nor
> --deny-retention flagged it. I fixed it in the entry by making those
> variables const. The compiler should keep these values out of the arena, or
> at least warn.

## What the compiler does today (seed 0.39.0)

Repro, `nish t.ts --deny-retention --emit-arena a.json`: exits 0, no warning.

```ts
function h(n: i32): i32 {
  let r: Result<i32, string> = Ok(n)
  if (r.isErr()) { r = Ok(0) }
  return r.unwrapOr(0)
}
function hc(n: i32): i32 {          // the user's workaround
  const r: Result<i32, string> = Ok(n)
  return r.unwrapOr(0)
}
```

- `hc`'s `Ok` is `placement: "stack"` — an entry-block alloca.
- `h` has two `nish_alloc_struct(i64 16)` and **no** `nish_arena_mark`/`release`;
  both sites are `"unscoped"`. Two effects:
  1. `localOutcome` sets `stable = false` for any local that is the left of an
     assignment (src/escape.ts ~1347-1353), so line ~1512
     (`site.stackable && opts.stackAlloc && flow === FLOW_LOCAL && outcome.stable`)
     sends the initializer to the arena.
  2. The assigned value is `USE_ESCAPE` in `classifyUse`
     (src/attributes.ts ~1262-1272); `useOutcome` has no flow target for it and
     falls to escape.ts ~838-840 → `Outcome(FLOW_LEAKS, …)`. That sets
     `allocLeaks`, and `arenaScope = directArena && !allocLeaks && …`
     (attributes.ts ~4907) goes false: the function loses its mark/release.
     For a callee-allocated (pointer) Result the `escapes` flag also climbs
     (attributes.ts ~5666, ~5804, ~4908), so callers lose their per-call and
     per-pass scopes too.
- A plain `for` in `main` still rewinds per pass, which is why tests did not
  see it; an event loop whose pass cannot scope (runtime callback root, or a
  pass that stores into older memory) never releases it.
- The documented gap: docs/LANGUAGE.md Memory model item 1 ("held by a
  reassigned `let`" stays in the arena), the known-gap line near
  LANGUAGE.md ~14476, docs/wp6-memory.md ~226-247 ("Left out").

Why no warning: NL9003/NL9016 (src/checker.ts `isArenaReassignment` ~3030,
`checkPassDrop` ~3095) gate on `perfAllocatesVisibly` (~2854), which counts
`new`, literals, templates, string `+` and `readFileSync*` — not `Ok`/`Err`,
and a user call returning a Result is excluded on purpose. NL9011 needs a loop
whose pass a callee blocks; the event-loop shape is not reported. Only
`--explain-memory` ("`h` keeps what it allocates until the memory of its caller
is released") and `--emit-arena` show it, and `--deny-retention`
(`isRetentionCode`, src/compilation.ts ~386: NL9002, NL9003, NL9011, NL9016)
reads neither.

## Stage 1 — let-reassign-scope

**Owns:** `src/escape.ts`, `src/attributes.ts`, `src/emit*.ts`, `tests/cases/**`, `tests/differential/**`, `tests/self/goldens/**`, `tests/nish-cmp.js`, `tests/link/**`, `docs/LANGUAGE.md`, `docs/wp6-memory.md`, `docs/guide/language/memory.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`

The fix is in the analysis, not in a new construct. An assignment `x = v` into
a local `x` hands `v` to `x`; `v`'s flow is `x`'s flow
(`localOutcome(x)`), not LEAKS. If `x` never leaves the call (not returned,
captured, stored into older memory, or aliased by something that does), the
function keeps its arena scope, and each stackable site can have its own
alloca: a reassignment changes which slot `x` points at, never the contents of
a slot an older reader still holds. Where any of those conditions fails, keep
today's arena placement — soundness wins over the saving.

Watch: a reassignment inside a loop where an older value is read after a later
pass's site is created (one alloca per site is then reused per pass — keep the
arena or prove no reader spans passes); `const old = r; r = Ok(1); use(old)`;
a closure capturing `r`; `return r`; `arr.push(r)`; the by-value Result path
(WP17) and the pointer-Result-from-a-call path (`let r = parse(s); if
(r.isErr()) r = parse(d)` — callee-allocated, so the fix there is the scope and
the `escapes` propagation, not a stack slot). Keep the `escapes` / `contained`
facts consistent between escape.ts and attributes.ts (`.claude/selfhost.md`;
rule 3 of orientation: no attribute without a proof).

### Tests

Each new case is a `tests/cases/<name>.ts` with a golden `.ll`, a `.out`
native round trip, and `.arena` where the placement is the point. At least:
the user's shape (stack or scoped, `Arena.used()` equal before and after 100k
calls from a loop that cannot scope per pass), the pointer-Result shape
(scoped per call), and one case per unsound neighbour above proving the value
is still correct after the call returns. Register new positives with
`node tests/differential/goldens.js --update`. Existing goldens that move
(`result_loop_outer_let`, `mem_stack_escape`, `res_*`, …) are regenerated and
read.

### Docs

LANGUAGE.md Memory model item 1 and the known-gap line now say what a
reassigned `let` does; docs/wp6-memory.md "Left out" records it as built;
docs/guide/language/memory.md "What you do have to think about" drops or
narrows the case. The IR cookbook regenerates if a recipe moves.

## Stage 2 — retention-warn

**Owns:** `src/checker.ts`, `src/codes.ts`, `src/compilation.ts`, `src/emit-result.ts`, `src/escape.ts`, `src/attributes.ts`, `std/**`, `tests/cases/**`, `tests/wordings/**`, `tests/link/**`, `tests/run.js`, `tests/self/goldens/**`, `tests/differential/**`, `tests/nish-cmp.js`, `docs/LANGUAGE.md`, `docs/guide/**`, `docs/reference/**`, `scalar.config.json`, `CHANGELOG.md`

Depends on stage 1 to *start*: its quiet cases are stage 1's newly-stacked
shapes, and its trigger reads the escape facts stage 1 changes.

1. `Ok(..)`/`Err(..)` count in `perfAllocatesVisibly` when the result is
   boxed (`isResultConstructorCall`, src/emit-result.ts ~173, needs program and
   table), so NL9003 and NL9016 fire on the Result drop shapes. User calls
   returning a Result stay out of that predicate.
2. A new warning (next free code, NL9018; a unique message substring in
   `performanceRules`): a root-package function whose allocations no scope
   releases (`allocLeaks` / no `arenaScope`, the `--explain-memory` "keeps what
   it allocates" finding) reached from a loop pass, naming the function and its
   first allocation line, and the fix (`const`, a `using a = arena()` block, or
   a region). Add it to `isRetentionCode` and `denyRetention`'s doc comment.
3. The performance gate (`.claude/testing.md` → shipped std/ and src/ produce
   no performance warnings) stays green. A hit in `std/` is either a real leak —
   fix it in this stage, smallest change — or a false positive, which narrows
   the rule. Say which in the PR body for each.

Tests: `tests/wordings/nl9018_*` (the `codes:` check requires one),
`perf_*` positive and quiet cases, `reject_deny_retention_*` for NL9018 and for
a Result-shaped NL9003. Docs: LANGUAGE.md retention rules and "Retention as an
error", docs/guide/language/memory.md, the diagnostics reference regenerated by
`node scripts/gen-reference.mjs`.

## Verification

Per CLAUDE.md: `npm run check`, `npm run lint`, the targeted sections in each
stage's `verification`, `WASI_SYSROOT=/usr node tests/run.js wasi` and
`node tests/run.js performance` for any `src/` change, nish-cmp with narrow
`DECLARED` entries for IR that moves, `node tests/self/goldens.js --update` and
read the diff. CI's eight `test` shards are the full-suite gate.
