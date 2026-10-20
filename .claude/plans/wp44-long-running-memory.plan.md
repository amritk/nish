---
name: WP44 — memory for programs that do not exit (WP34 N9, phase two), the design note
overview: Issue #482. Write docs/wp44-long-running-memory.md, comparing regions (`using m = region()`), a safe arena reset, and reference counting for long-lived state whose size is not known at start-up. Give each option's escape-analysis rules as checker rules with NL codes, and measure its cost on a case from the relay or the HTTP servers. Recommend one, with a staged plan for building it. Nothing in `src/`, `std/` or `runtime/` changes; building it is a later issue.
stages:
  - id: note
    title: The WP44 design note, measured
    goal: A docs/wp44-long-running-memory.md that compares the three options, gives each one's checker rules, measures each one's cost on the relay or an HTTP server and on a toy cache, recommends one, and stages its build. It is indexed from docs/README.md and docs/MASTER_PLAN.md, and WP34 N9 points to it
    verification: node docs/check-links.mjs, npm run lint and npm run check exit 0; an undegraded npm test before the PR opens (read the skip count); git diff --stat origin/main shows nothing under src/, std/, runtime/ or tests/cases/
    status: pending
    todos:
      - id: note-baseline
        content: Measure today's baseline — the relay soak (tests/link/net_relay_soak) and an HTTP/1.1 server (tests/link/net_http1_server or examples) under a growing-state workload, such as a session map or a cache keyed by client, with Arena.used() and RSS over time showing the leak the note exists for — see Measurements
        status: pending
      - id: note-options
        content: For each of regions, a safe arena reset and reference counting, write the semantics, the escape and region rules as checker rules with the NL24xx refusals they add or reuse, the runtime and ABI they need, and the relay's and a toy LRU cache's code under it — see The options
        status: pending
      - id: note-measure-options
        content: Measure each option's native cost without implementing it, using hand-written IR or C prototypes linked with the runtime, or the existing using-arena/pool constructs emulating it. Report throughput and memory on the measured case, in interleaved rounds with a noise band, and confirm WP33's rule that no .ll golden moves for a program that does not use the option — see Measurements
        status: pending
      - id: note-interactions
        content: State how each option interacts with Secret<T> wiping (nish:secret), nish:net's slot-owned buffers, `scope()` and pass scopes, spawn/parallel bodies, and the wasm32/wasi targets — see Interactions
        status: pending
      - id: note-decision
        content: Recommend one option with the measurements that decide it, list the rejected options and why, and give a staged build plan (stages, the files each owns, its negative tests, which release the rolling freeze lets src/ use it from) — see Decision
        status: pending
      - id: note-index
        content: Add the WP44 row to docs/README.md and docs/MASTER_PLAN.md, and point WP34 §4 N9 and its §8 row at the note — see Indexing
        status: pending
---

# WP44 — memory for programs that do not exit: the design note

Source: [amritk/nish#482](https://github.com/amritk/nish/issues/482), WP34 §4 N9
and its §8 row. The arena never frees an object. Phase one (the relay) gets by on
discipline: pools sized at start-up, no allocation per packet, pass scopes and
`using a = arena()` around per-request work. That fails for **long-lived state
whose size is not known at start-up**: caches, a session map that grows with
users, per-match worlds, and connection-scoped data that outlives a request.

**Do not implement.** The PR adds a note and index rows. Prototypes used to
measure stay out of the tree, or go under `bench/wp44-memory/` only if a
reviewer needs to reproduce a figure. A figure in the note names the command
that produced it.

## Owns

Owns: `docs/wp44-long-running-memory.md`, `docs/README.md`, `docs/MASTER_PLAN.md`, `docs/wp34-hosting-cs.md`, `bench/wp44-memory/**`

## Measurements

- **Baseline.** Show the leak first. The relay's soak is flat because its state is
  in pools, so pick the workload phase one cannot hold flat: the relay with a
  session table that is not capped at compile time, or an HTTP server holding a
  per-client cache. Plot `Arena.used()` and RSS against requests.
- **Per option.** Measure throughput (requests/s, or ns per op on a cache
  get/put loop) and steady-state memory. Follow CLAUDE.md's measurement rule:
  input changes every iteration, output folds into a printed checksum, and the
  baseline is timed against a byte-identical copy of itself in the same
  interleaved rounds to give the noise band. Claim a difference only outside
  that band.
- **WP33's rule.** A program that does not use the option keeps every `.ll`
  golden. Say for each option whether it can meet that rule. Refcounting on every
  heap value cannot; refcounting on an opt-in type can.

## The options

For each of **regions** (`using m = region()`, objects allocated into a named
region that is freed as a unit), **a safe arena reset** (`Arena.reset`'s
replacement, checked so that nothing allocated since the mark survives it), and
**reference counting** (all heap values, or an opt-in `Rc<T>`-like type):

- semantics a user sees, in LANGUAGE.md's register;
- checker rules: what may escape, what may be stored where, and how `new`,
  every declarator of a `using`, and `this` out of a constructor are covered
  (CLAUDE.md's three shapes), with the NL code each refusal reuses or adds;
- runtime pieces and their ABI; cycles (refcounting); fragmentation (regions);
- the relay's session code and a toy LRU cache, written under the option.

## Interactions

`Secret<T>` wiping (freed or reset memory holding secrets: is the wipe still
guaranteed, and is it ordered before the free?), `nish:net`'s slot-owned and
scratch buffers (QUIC-3, H3-1/H3-3), `scope()` and pass scopes, the existing
NL24xx `using a = arena()` refusals, parallel and spawn bodies (each thread's
own arena), and wasm32/wasi.

## Decision

One recommendation, with the figures that decide it. A staged plan in the
house shape (each stage: goal, the files it owns, golden and negative tests,
docs/guide pages it will touch), noting that `src/` can only use the construct
one release after it ships (the rolling freeze).

## Indexing

A `docs/README.md` row and a `docs/MASTER_PLAN.md` §5 row (WP44, "proposed"),
and WP34 lines 263–264 and its §8 N9 row pointing at the note. Grep for "note
that the game server needs" and other pointers to the unwritten note, and
update every one. No `docs/guide/` page, because nothing user-visible changes.

## Verification

`node docs/check-links.mjs`, `npm run lint` and `npm run check` exit 0 (read
the exit status, not a piped tail). Run one undegraded `npm test` before the PR
opens. The diff touches only the Owns globs. Commit subject:
`docs(runtime): weigh regions, arena reset and refcounting for long-running servers`,
with a body written as its changelog entry, a `Measured:` trailer carrying the
deciding figures and noise band, and `Fixes #482` in the PR body.
