---
name: CI-runner, c-symbols and NL9007 rules written down
overview: Three conventions a past run learned the hard way go into the repo's rules, where the next session reads them before it writes the check. A spawn or sandbox check in tests/run.js runs on CI's ubuntu runners (uutils coreutils, descriptors the runner hands node), so it proves behaviour with a helper it builds and that helper's exit status. A runtime change runs the c-symbols section and reserves any new libc call in src/c-symbols.ts. A new unproven index in src/ fails the NL9007 ratchet in the performance section.
stages:
  - id: ci-runner-rules
    title: "docs: write down the CI-runner rule for spawn checks and the c-symbols and NL9007 gates"
    goal: CLAUDE.md states the three rules in its definition of done, and the guide each belongs to carries the detail and the reason
    verification: node docs/check-links.mjs && npm run lint
    status: pending
    todos:
      - id: claude-md-lines
        content: Add the three rules to CLAUDE.md's "Definition of done", each short and pointing at its guide section — see Stage 1, CLAUDE.md
        status: pending
      - id: testing-md-runner
        content: Add a section to .claude/testing.md on checks that spawn or sandbox and run on CI's runners — see Stage 1, testing.md
        status: pending
      - id: selfhost-md-runtime
        content: Add the c-symbols reservation and the NL9007 ratchet to .claude/selfhost.md — see Stage 1, selfhost.md
        status: pending
---

# CI-runner, c-symbols and NL9007 rules written down

## Requirements (verbatim)

> CI's runners are not this container. A spawn or sandbox check in
> tests/run.js runs on ubuntu with uutils coreutils (one multicall binary whose
> messages differ from GNU's) and with descriptors the runner hands node. Prove
> behaviour with a helper the check builds and its exit status, never a tool's
> message text or the test process's own descriptor count.
>
> A runtime change runs node tests/run.js c-symbols. A new libc call in
> runtime/*.c must be reserved in src/c-symbols.ts, and a new unproven index in
> src/ fails the NL9007 ratchet in node tests/run.js performance.

## Stage 1: ci-runner-rules

**Owns:** `CLAUDE.md`, `.claude/testing.md`, `.claude/selfhost.md`

Docs only. No source, test or generated file changes, so no goldens, no
nish-cmp entries and no reference regeneration. The commit subject is the
stage title (a `docs:` entry in the changelog).

### CLAUDE.md

In "Definition of done", in the house voice (short, bold lead, pointer to the
guide that holds the detail):

- **CI's runners are not this container.** The first paragraph of the
  requirements, nearly verbatim, with a pointer to the new `.claude/testing.md`
  section.
- **A runtime change runs `node tests/run.js c-symbols`**: a new libc call in
  `runtime/*.c` is reserved in `src/c-symbols.ts`. Fold it into or beside the
  existing "A change to `src/` also runs `wasi` and `performance`" sentence.
- Extend that sentence: a new index in `src/` the prover cannot discharge is an
  NL9007 warning, and the ratchet in `node tests/run.js performance` fails on
  it (`tests/perf-baseline.json` only moves down).

CLAUDE.md is read by every session, so keep each addition to two or three lines.

### testing.md

A new section (near "Running a subset" or "The performance gate") on a check in
`tests/run.js` that spawns a process or runs one under `--sandbox`:

- CI runs it on ubuntu runners whose coreutils are uutils — one multicall
  binary whose messages, and sometimes exit codes, differ from GNU's — and node
  there inherits descriptors from the runner, so `/proc/self/fd` of the test
  process counts more than this container's.
- So the check builds its own helper (a small C or Nish program) that does the
  one thing being proven and reports it by exit status; it asserts on that
  status. It never matches a tool's message text and never counts the test
  process's own descriptors.

Do not invent incident numbers. Cite a PR only if `git log` shows one that
fixed exactly this.

### selfhost.md

- In "Changing the runtime": a bullet that a new libc call in `runtime/*.c` is
  reserved in `src/c-symbols.ts` (#618's check, `node tests/run.js c-symbols`,
  reads `llvm-nm` over the runtime's objects and fails on a name not reserved).
  Update the "Four pairings" count in that section's lead.
- Where `src/`'s testing is described, a line that a new unproven index is an
  NL9007 warning the ratchet in `node tests/run.js performance` fails on, and is
  proven away with a guard rather than raised in `tests/perf-baseline.json`
  (`.claude/testing.md` → "The performance gate" holds the detail; point there,
  do not restate it).

### Verification

`node docs/check-links.mjs && npm run lint`, both exit 0, run bare (not piped).
Every command, file and section the new text names must exist on `main`:
check each with `grep`/`ls` before pushing.
