---
name: WP22 — arrow functions as the declaration form
overview: Arrows are accepted and the corpus is rewritten; the only box left is stage D, rejecting a function definition, which is a breaking change awaiting the owner's decision.
roadmap: docs/roadmap/wp22-arrow-functions.md
spec: docs/wp22-arrow-functions.md
priority: 80
issue: 1866
stages:
  - id: d-reject-function
    title: WP22 D — reject a function definition
    goal: A function declaration is a compile error with a quick-fix to the arrow spelling, and the diagnostics that name the entry say the arrow form.
    verification: node tests/run.js arrow-corpus && node tests/run.js link && npm run check && npm run lint
    status: pending
    labels: [needs-decision]
    todos:
      - id: d-rule
        content: Add the rejection of function definitions and its code in src/ with a tests/link negative — see WP22 D
        status: pending
      - id: d-entry-text
        content: Reword the NL2229 and NL2149 messages from export function main to the arrow spelling and grep every expected file — see WP22 D
        status: pending
      - id: d-allowlist
        content: Drain tests/function-spelling-allowlist.txt and the async definitions that have no arrow spelling — see WP22 D
        status: pending
---

# WP22 — arrow functions as the declaration form

## Context
Stages A to C landed: both compilers accept `const f = (...) => ...`, both spellings emit byte-identical IR, docs, examples, `src/`, `std/` and tooling are rewritten, a Biome rule blocks new `function` declarations, and the test corpus is arrows (the `arrow-corpus` check keeps it). See [the roadmap page](../../docs/roadmap/wp22-arrow-functions.md). Spec: [design note](../../docs/wp22-arrow-functions.md).

## WP22 D — reject a function definition
Rejecting `function` withdraws an accepted construct. What is left is 101 non-`async` definitions, each a refused form under test or kept for a reason the allowlist records, and the `async` ones, which have no arrow spelling to move to ([§7](../../docs/wp22-arrow-functions.md#7-the-surfaces-measured), [§9a](../../docs/wp22-arrow-functions.md#9a-the-function-declarations-stage-d-may-not-simply-delete)). The diagnostics naming the entry still say `export function main`; rewording them retires NL2229 and NL2149 for a spelling change, which is stage D's to do.
Likely files: `src/parser.ts`, `src/checker*.ts`, `tests/function-spelling-allowlist.txt`.

### Decision needed
Whether stage D happens at all ([§10](../../docs/wp22-arrow-functions.md#10-open)). Do it now: a breaking minor on 0.x, cheaper than a major after 1.0. Leave it undone: no break, but two spellings stay accepted. The note does not recommend either.
