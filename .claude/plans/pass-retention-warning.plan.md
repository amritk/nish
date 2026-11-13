---
name: A warning for memory that piles up across the passes of an unbounded loop
overview: Add performance warning NL9018. It fires when an allocation in the program's own code runs on every pass of a loop that releases nothing per pass, and no counted loop bounds how many passes run before the memory is released. That is the shape of every request loop built on Http1Server, where a per-request temporary in the handler grows the process for as long as it serves. Today only `--explain-memory` and `--emit-arena` show it, and nothing warns. The warning changes no byte of the IR, it is a retention finding under `--deny-retention`, and it names the rewrite: a `using a = arena()` block around the per-pass work.
stages:
  - id: unbounded-pass
    title: feat(checker) — warn when an unbounded loop keeps what each pass allocates (NL9018)
    goal: A program whose unbounded loop keeps a per-pass allocation (an Http1Server request loop with a temporary in its handler) gets an NL9018 warning that names the loop, the allocation and the rewrite; bounded loops and allocation-free servers stay silent; the IR does not change
    verification: npm run check && npm run lint && npm run lint:dead && node tests/run.js arena && node tests/run.js explain_memory && node tests/run.js retention && node tests/run.js nl9018 && WASI_SYSROOT=/usr node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js && node tests/self/goldens.js && node scripts/gen-diagnostic-codes.mjs --check && node scripts/gen-reference.mjs --check && node docs/check-links.mjs
    todos:
      - id: rule
        content: Implement the NL9018 finder beside arenaLoopFindings in src/escape.ts, reading the same facts --emit-arena's `accumulates` reads, firing only where some loop between the site and its release is not counted (isCountedLoop, src/attributes.ts) — see Stage unbounded-pass → The rule
      - id: report
        content: Report it from Compilation (src/compilation.ts, beside reportArenaLoops) through sink.reportPerformance for the root package's modules only, register NL9018 in src/codes.ts performanceRules, and add it to isRetentionCode so --deny-retention makes it NL2462 — see The rule
      - id: tests
        content: Positive warning case, bounded-loop quiet case, server-shaped link test on std/net/http1-server with and without the arena-block rewrite, tests/wordings/nl9018_*, reject_deny_retention_unbounded_pass, a --json code check and a --no-warn-performance check — see Tests
      - id: docs
        content: docs/LANGUAGE.md (the Retention-as-an-error table and the warning's rule), docs/guide/language/memory.md, the server guide pages (docs/guide/**/api-server.md or networking.md) on keeping a request loop flat, AGENTS.md's --deny-retention row and docs/AI.md — see Docs
      - id: regen
        content: Regenerate tests/self/goldens/checked, docs/reference, the diagnostic-code outputs and any newly-warning case's expected stderr with the repo's tooling; register new positive cases with tests/differential/goldens.js --update; report the count of existing cases that newly warn in the PR body — see Tests
---

## Stage `unbounded-pass`

**Owns:** `src/**`, `tests/cases/**`, `tests/wordings/**`, `tests/link/**`, `tests/run.js`, `tests/self/goldens/checked/**`, `tests/differential/**`, `tests/nish-cmp.js` (only if nish-cmp moves, which it must not), `docs/LANGUAGE.md`, `docs/guide/**`, `docs/reference/**`, `docs/AI.md`, `AGENTS.md` (the `--deny-retention` row lists the retention codes), `scalar.config.json` (only if a new guide page needs a route). Not `std/**`: Http1Server itself does not change in this stage.

One stage, one PR: the rule, its code, its tests and its docs are one chain, and splitting it buys no parallelism.

### Context

Measured by the lead before planning, with `build/nish` built from `main` at the base SHA:

- `examples/file-server.ts --explain-memory` lists all 5 allocating loops as keeping what a pass allocates. Each is refused its per-pass scope because the pass calls `Http1Server.accept`, `Http1Connection.respond` or `Http1Connection.abort`, and each of those stores an allocation into memory older than the pass: the connection pool, `headBytes` (`std/net/http1-server.ts` ~1664), and buffers returned to the pool. That refusal is correct. Scoping those passes would free a live connection.
- The stock file-server allocates nothing per request in its own code. Its RSS is flat (about 1.9 MB after 40,000 requests).
- Add one interpolated string per request in the handler branch and RSS grows from 5.2 MB to 8.5 MB over 20,000 requests. `--emit-arena` marks that site `unscoped`, `"accumulates":true`, and **no warning fires**.
- NL9011 (`arenaLoopFindings`, `src/escape.ts` ~2813) is silent by design. It needs a callee that `leavesGarbage` (net-allocates **and** is contained), and every Http1 callee stores, so none is contained. It also never considers a direct allocation in the loop body. NL9003 and NL9016 are about locals dropped by assignment.
- `accumulates` alone is far too broad to warn on. 151 of the 1,154 positive `tests/cases/*.ts` have an accumulating site, including `perf_arena_pass_quiet`, which pins silence. Nearly all of them are counted `for` loops over a known length, where the pile is bounded by the input.

### The rule

NL9018 fires for an allocation site in a module of the root package (the scope `--explain-memory` and `--deny-retention` use) when all of these hold:

1. **It accumulates.** `--emit-arena` would mark it `"accumulates":true`: it runs on every pass of a loop (or in that loop's condition or update) that releases nothing per pass, and its memory is unreachable before its release. Read the same fact. Do not re-derive it, so the warning and the audit file cannot disagree.
2. **Nothing bounds the pile.** At least one loop between the site and the point its memory is released is not a counted loop. Share `isCountedLoop` from `src/attributes.ts`; do not write a second notion of "counted". A `while (true)` poll loop, a `while (event !== H1_NEED_MORE …)` event loop, and any loop whose condition is not a counted comparison are unbounded. A counted `for` over `xs.length` nested inside a `while (true)` that releases nothing is unbounded too.
3. **No other retention warning already names it.** If NL9002, NL9003, NL9011 or NL9016 reports the site, NL9018 stays silent there.

There is at most one NL9018 per loop. Anchor it at the innermost loop around the site whose pass releases nothing, the line `--explain-memory` uses for that loop. It names:

- the first accumulating site (its line and its kind, from the `--emit-arena` kinds);
- how many more sites there are, if any;
- where the memory does go back (the same phrase `--explain-memory` uses);
- the reason the pass has no scope (the refusal `--explain-memory` prints);
- that nothing bounds the number of passes;
- the rewrite: move the per-pass work that builds the temporary into a `using a = arena()` block inside the loop body. The compiler checks that block and refuses it if anything allocated inside could outlive it, so the advice is sound by construction.

The exact wording is the worker's, held to the voice of the neighbouring NL9011 and NL9016 messages. The `performanceRules` substring in `src/codes.ts` must match it.

- **It is a performance warning.** `--no-warn-performance` silences it, and `--json` reports `"code":"NL9018"`.
- **It is a retention finding.** Add NL9018 to `isRetentionCode` (`src/compilation.ts` ~386), so `--deny-retention` turns it into NL2462 in the root package, the same way it does for the other four.
- **It changes no byte of the IR.** nish-cmp must pass with no `DECLARED` entry.
- **Its cost is not measurable.** It reads facts already computed. `node tests/run.js performance` must stay green.

### Tests

- `tests/cases/perf_arena_unbounded_pass.ts` (with its `.ll` and `.out`, plus the `tests/run.js` block that checks the warning text and position, modelled on `perf_arena_pass_drop` ~5562). It needs a `while` loop with no bound that builds a temporary each pass, in a pass refused by a store into a structure older than the loop. Also cover a `for` over a length nested in it, and a loop with two sites, to show the count.
- `tests/cases/perf_arena_unbounded_quiet.ts`, which pins silence for each of these:
  - the same temporary inside a `using a = arena()` block;
  - a counted `for` that accumulates (bounded);
  - a site NL9016 already names (no double report);
  - a loop whose pass is scoped.
  `perf_arena_pass_quiet` must stay quiet.
- `tests/wordings/nl9018_unbounded_pass.{ts,err}`.
- `tests/cases/reject_deny_retention_unbounded_pass.{ts,args,err}`.
- A server-shaped test on `std/net/http1-server` (a `tests/link/` program, or a `tests/run.js` block in the existing http1 section) checks four things:
  - a request loop with a per-request temporary in the handler warns;
  - the same loop with that work in a `using a = arena()` block compiles with no NL9018 and no NL2416-family refusal;
  - `examples/file-server.ts` as it stands compiles with no NL9018;
  - where the section already runs servers natively, the rewritten server's RSS stays flat across a few thousand requests (measured by exit status of a helper, per `.claude/testing.md`, not by parsing tool text).
- `--json` code and `--no-warn-performance` checks, where the existing NL9016 ones live.
- Run every existing positive case through the new rule (the lead's 151-case list is a starting point) and report in the PR body how many newly warn. Each newly warning case must be a genuine unbounded accumulation. Its expected stderr is regenerated, never hand-edited. A count above about 10 means the rule is too broad: stop and say so in the PR body rather than widening the golden churn.

Show the exact LLVM IR for each new `.ts` snippet in the PR body, as `CLAUDE.md` requires.

### Docs

- `docs/LANGUAGE.md`:
  - add NL9018 to the table in "Retention as an error";
  - give the rule its own bullet list beside the NL9011 and NL9016 rules, with test names;
  - add one line in "Explaining kept memory" saying that the loops it lists with no bound are the ones NL9018 warns about.
- `docs/guide/language/memory.md`: what NL9018 says and the `using a = arena()` rewrite, with a short example.
- The server guide pages (`docs/guide/**/api-server.md`, `networking.md` or whichever page builds an Http1Server loop): one short section on keeping a request loop flat. Per-request temporaries go in a `using a = arena()` block, and NL9018 points at the ones that do not.
- `AGENTS.md`: the `--deny-retention` row lists NL9018 beside NL9002, NL9003, NL9011 and NL9016.
- `docs/AI.md`: where it explains memory retention for program authors, add one line on NL9018 and the arena block.
- Grep for every other place that lists the four retention codes, and update each one.
- Regenerate `docs/reference/` with `node scripts/gen-reference.mjs`.
