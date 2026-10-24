---
name: CI shards are the full-suite gate
overview: Stop cloud sessions running the unsharded `npm test` twice per PR. Locally run check, lint and the touched sections of tests/run.js; the full-suite gate becomes every CI `test` shard green on the current head, skip counts read from the shard summaries. Docs only.
stages:
  - id: rule
    title: "docs: make CI's test shards the full-suite gate"
    goal: Every agent-facing doc states one rule — targeted local runs, CI's four `test` shards as the full-suite gate — and no pointer to the old twice-per-PR local run survives.
    verification: test -z "$(grep -rnE 'twice per pull request|40–70 min' CLAUDE.md AGENTS.md .claude docs/AI.md)" && git diff --quiet origin/main -- tests scripts .github && npm run check && npm run lint && node docs/check-links.mjs
    todos:
      - id: claude-md
        content: Rewrite CLAUDE.md "Definition of done" and the "Spending tokens" bullet to the new rule — see The rule, Per file
        status: pending
      - id: agents-md
        content: Rewrite AGENTS.md "Trusting a test run", the "Shipping a change" list and merge conditions 1 and 3, the Workflow command list and the House rules bullet — see Per file
        status: pending
      - id: claude-guides
        content: Update .claude/testing.md, .claude/orientation.md and .claude/selfhost.md where they say what a session runs before a PR — see Per file
        status: pending
      - id: ai-md
        content: Update docs/AI.md item 11 — see Per file
        status: pending
      - id: old-pointers
        content: Repoint the full-suite line in .claude/plans/wp33-r3-r4-round-trip.plan.md and any other hit of the grep — see Pointers
        status: pending
---

## Context

[CLAUDE.md](../../CLAUDE.md) "Spending tokens" tells a session to run the full, unsharded `npm test` (`node tests/run.js`) twice per PR — before opening it and after the last merge of `main`. In a 4-core cloud session that is 40 to 70 minutes each time. CI's `test` job ([.github/workflows/ci.yml](../../.github/workflows/ci.yml), `test (…, shard N/4)`) already runs the whole suite in four cost-dealt shards on every push: about 14 minutes wall and 46 runner-minutes (run 40063074019). The local runs duplicate it.

## The rule

State it once, in these words or close to them, and point the other files at it rather than restating it in full:

- **Locally**, before pushing: `npm run check`, `npm run lint`, and `node tests/run.js <filter>` for every section or program the change touches.
- **A change to `src/`** also runs `node tests/run.js wasi` (with `WASI_SYSROOT=/usr`; read its skip line), `node tests/run.js performance`, and regenerates the goldens — unchanged from today.
- **The full-suite gate is CI**: every `test` shard green on the current head, and each shard's summary (`N passed, M failed, K skipped, 1 delegated.`) read the way "Trusting a test run" reads a local run — no `DEGRADED:` banner, no skip outside the environmental ones. The `1 delegated` is the fixed point handed to the `bootstrap` row, not a skip.
- **A session still runs the full suite** when the change is to the suite itself (the structure of `tests/run.js`, `tests/pool.js`) or when CI cannot answer (a fork PR, whose CI does not run). It says so in the PR body.
- **Keep** the "wait for a long run without polling" guidance (commit first, background with output to a file, end the turn, never two runs at once).

Lines that only describe what `npm test` *does* (what it builds, that it needs LLVM, what the skip count means) stay as they are.

## Stage `rule`: docs — make CI's test shards the full-suite gate

**Owns:** `CLAUDE.md`, `AGENTS.md`, `docs/AI.md`, `.claude/testing.md`, `.claude/orientation.md`, `.claude/selfhost.md`, `.claude/plans/wp33-r3-r4-round-trip.plan.md`, plus any other `docs/**/*.md` or `.claude/**/*.md` a Pointers grep shows still states the old rule. Never `tests/`, `scripts/`, `.github/`.

One stage, one PR: the rule is one sentence restated in seven files, and splitting it would let the wording drift between PRs that the grep criterion has to judge together.

## Per file

| File | Where | Change |
| --- | --- | --- |
| [CLAUDE.md](../../CLAUDE.md) | Definition of done | "an undegraded `npm test` green" → the local runs plus every CI `test` shard green on the current head, skip counts read from the shard summaries |
| [CLAUDE.md](../../CLAUDE.md) | Spending tokens | Replace the twice-per-PR bullet with the rule; keep the no-polling bullet |
| [CLAUDE.md](../../CLAUDE.md) | the `src/` paragraph | Already says wasi + performance; make sure it reads as *in addition to* the targeted runs |
| [AGENTS.md](../../AGENTS.md) | Workflow command list | `npm test` comment says it is the full suite CI runs in four shards; locally for the suite-change and fork cases |
| [AGENTS.md](../../AGENTS.md) | Trusting a test run | Add how to read the shard summaries (four summaries, each read like a local one; `1 delegated` is not a skip) |
| [AGENTS.md](../../AGENTS.md) | Shipping a change → *Fully tested* | The `npm test` bullet becomes the targeted local runs plus the CI shards |
| [AGENTS.md](../../AGENTS.md) | Merging it yourself, conditions 1 and 3 | 3 "The suite was actually run" → every CI `test` shard green and undegraded on the current head (or the local full run in the two exception cases, said in the PR body) |
| [AGENTS.md](../../AGENTS.md) | House rules | "`npm test` must be green" → the CI shards |
| [.claude/testing.md](../testing.md) | Running a subset (and wherever it says what to run before a PR) | The rule, or a pointer to CLAUDE.md |
| [.claude/orientation.md](../orientation.md) | Commands, Definition of done | Same |
| [.claude/selfhost.md](../selfhost.md) | where it says what a `src/` change runs | wasi + performance + goldens locally; the full suite is CI's shards |
| [docs/AI.md](../../docs/AI.md) | item 11 | "`npm run check` and `npm test` green" → the local runs and CI's `test` shards |

## Pointers

`grep -rnE "twice per pull request|40–70 min" CLAUDE.md AGENTS.md .claude docs/AI.md` must print nothing. Today it also hits [.claude/plans/wp33-r3-r4-round-trip.plan.md](wp33-r3-r4-round-trip.plan.md) line 690, which cites the CLAUDE.md rule; repoint it. Also grep for other phrasings of the old rule ("full suite", "npm test", "twice") in the same files and in `docs/` and repoint any that tell a session to run the full suite locally.

## Out of scope

No change to `tests/`, `scripts/` or `.github/`. No change to how `npm test` behaves or what CI runs.

## Verification

```bash
test -z "$(grep -rnE 'twice per pull request|40–70 min' CLAUDE.md AGENTS.md .claude docs/AI.md)"
git diff --quiet origin/main -- tests scripts .github
npm run check
npm run lint
node docs/check-links.mjs
```

A docs-only change runs no local test section; its full-suite gate is CI's shards, the rule it introduces.
