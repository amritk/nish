---
name: Destructuring declarations in strict Nish
overview: Accept `const`/`let` object and array patterns (and the same in a `for...of` head) over class/interface values and `T[]`, lowered to one field load or one bounds-checked indexed read per name, reusing the `const [a, b] = await awaitAll(…)` path; keep every other pattern refused with a precise diagnostic. One new construct, one PR, feat(checker).
stages:
  - id: s1-destructuring
    title: "feat(checker): destructuring declarations over objects and arrays"
    goal: "`const { x, y: py } = p`, `let [a, , c] = xs` and `for (const { x, y } of points)` compile to one field load / one bounds-checked element read per name with no struct copy, run natively with the same output as Node, and every out-of-scope pattern is refused with its own diagnostic and negative test; the construct ships with its golden .ll, llvm-as pass, native round trip, LANGUAGE.md rule, IR_COOKBOOK entry and user-guide page."
    verification: npm run check && npm run lint && node tests/run.js destructur && node tests/run.js await_all && node tests/run.js wasi && node tests/run.js performance && node scripts/gen-reference.mjs --check && node docs/check-links.mjs
    todos:
      - id: read-first
        content: Read CLAUDE.md, AGENTS.md, .claude/orientation.md, .claude/selfhost.md, .claude/architecture.md, .claude/testing.md and docs/ARCHITECTURE.md → "How to add a construct" (the checklist this PR must satisfy item by item). The prompt's LANGUAGE.md line numbers are stale; the passages are now near docs/LANGUAGE.md:1278 (the loop pass's "no destructuring store"), :7466 (the refusal rule) and :16082 (the refusal index).
      - id: parser
        content: Extend `parseBindingName`/`parseNamePattern` (src/parser.ts ~2156-2200) so object patterns (`{ x, y: py }`) and array patterns with holes (`[a, , c]`) build a BindingPattern tree instead of being skipped; keep defaults, rest and nested patterns recognisable so the checker can refuse each by name. Assignment patterns stay unparsed-as-binding and are refused at the assignment.
      - id: checker
        content: In src/statements.ts (~1074-1090, ~352) accept a pattern on a `const`/`let` local and a `for...of` head when the initialiser is a class or interface value (object pattern; each key must be a field) or `T[]` (array pattern). Reuse the awaitAll pattern binding (nodeLocals on each name, src/async-check.ts ~432) rather than a second path. New diagnostics, each its own code in src/codes.ts (next free number in its band) and its own negative test under tests/cases/reject_*: assignment pattern (array and object forms), default inside a pattern, rest element, nested pattern, a key that is not a field, a pattern over `T | null`, over a Map, over a string. Parameter patterns keep NL2192 / `reject_param_destructured`. Top-level `const` patterns: accept only if the module-constant path takes it cheaply; otherwise keep `reject_const_destructured` and write why in LANGUAGE.md.
      - id: emit
        content: Lower an object pattern to exactly one field load per name off the receiver (no struct copy) and an array pattern to one indexed read per non-hole name through the same bounds check and panic `xs[i]` uses; the receiver is evaluated once. Keep src/emit-arrays.ts `localsDeclaredIn` and src/loop-flow.ts correct for the new pattern children. Confirm the loop pass that assumes no destructuring *store* (LANGUAGE.md ~1278) is still true because assignment patterns are refused.
      - id: emit-ts
        content: Make --emit-ts pass the pattern through verbatim (src/emit-ts-*.ts; read types only via walk.typeAt, honour walk.untyped per CLAUDE.md) and register the new positive cases with `node tests/differential/goldens.js --update` so the differential run checks native output against Node.
      - id: tests
        content: Positive tests/cases with golden .ll (UPDATE_GOLDENS=1 node tests/run.js <case>), llvm-as pass and native round trip with expected stdout for object pattern, renamed key, interface receiver, array pattern with hole, `let` pattern, `for...of` object and array heads, and an out-of-range array pattern that panics exactly like `xs[i]`. An escape-analysis test showing an object that is only destructured stays stack-allocated. Keep the awaitAll cases passing unchanged. Show in the PR body the exact LLVM IR for every TypeScript snippet the PR adds.
      - id: freeze
        content: src/ must not use the new construct (rolling freeze; CI's bootstrap job). Run `node tests/run.js wasi` (WASI_SYSROOT=/usr) and `node tests/run.js performance` and read their skip lines; no new NL9007.
      - id: docs
        content: docs/LANGUAGE.md rule (what is accepted, the lowering, and that an out-of-range array element panics where Node gives `undefined`, because Nish has no `undefined`); update the refusal rules at ~7466 and ~16082 and the Map/Set `entries` wording if it still says "there is no destructuring"; docs/IR_COOKBOOK.md entry (regenerate with `bash docs/cookbook/regen.sh`); docs/guide/ page plus its route in scalar.config.json; docs/AI.md if it lists destructuring as refused; regenerate docs/reference with `node scripts/gen-reference.mjs`.
      - id: goldens
        content: Regenerate tests/self/goldens/checked/ with `node tests/self/goldens.js --update`, run tests/nish-cmp.js and add narrow DECLARED entries for any corpus program whose IR moves. Commit as `feat(checker): …` with Tests:/Refs: trailers; open the PR.
---

# Destructuring declarations in strict Nish

## Context

Today every binding pattern is refused — `Destructuring is not supported`
(`reject_destructure_local`), `Destructured constants are not supported`
(`reject_const_destructured`), `Destructured parameters are not supported`
(`reject_param_destructured`) — except `const [a, b] = await awaitAll(…)`,
which the parser keeps as a flat `BindingPattern` of identifiers
(`src/parser.ts` `parseNamePattern`), the checker binds in
`src/async-check.ts` (~432), and the emitter tracks through
`localsDeclaredIn` (`src/emit-arrays.ts` ~770). This PR generalises that one
path; it does not add a second.

## Stage s1-destructuring

**Owns:** `src/**`, `tests/**`, `docs/**`, `scalar.config.json`, `llms.txt`

One stage: parser → checker → emitter → emit-ts → docs is a chain where each
layer consumes the previous one's node shape, and the whole is one construct
the repo's checklist requires in a single PR. `std/` and `runtime/` should not
change; if one must, say why in the PR body.

### Accepted

- `const`/`let` object pattern over a class or interface value: `{ x, y }`,
  `{ x: px }`. One field load per name, no copy of the struct.
- `const`/`let` array pattern over `T[]`: `[a, b]`, holes `[a, , c]`. Each
  element is `xs[i]`'s bounds check and panic.
- Both forms in a `for...of` head.
- Top-level `const` patterns only if the module-constant path takes them
  cheaply; otherwise refused, and LANGUAGE.md says why.

### Refused, each with its own diagnostic and negative test

Assignment patterns (`[a, b] = [b, a]`, `({ x } = p)`), defaults in a pattern,
rest elements, nested patterns, parameter patterns (existing NL2192), a key
that is not a field, a pattern over `T | null`, a Map, or a string.

### Checks

Escape analysis still stack-allocates an object only destructured; emit-ts
passes the pattern through and the differential run agrees with Node; src/
does not use the construct; goldens, nish-cmp DECLARED entries and
docs/reference regenerated per CLAUDE.md.
