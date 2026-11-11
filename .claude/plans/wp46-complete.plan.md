---
name: WP46 — stage 3, the sessions server on regions and its 2,000,000-request soak
overview: Finish WP46. Rewrite the §1 sessions server so every session lives in a region the cache frees on eviction, prove it with a tests/link soak that reads Arena.mark() and anonymous resident memory flat across 2,000,000 requests, record the figures against today's baseline, close WP34 N9's game-server (per-match) note, and mark WP46 done on the roadmap.
stages:
  - id: soak
    title: "test(runtime): the sessions server on regions holds memory flat over 2,000,000 requests (WP46 stage 3)"
    goal: A linked HTTP/1.1 sessions server whose sessions live in regions serves 2,000,000 requests with Arena.mark() and anonymous resident memory flat past warm-up, pinned by a tests/link soak, and WP46 is marked done
    verification: node tests/run.js region_sessions_soak && node tests/run.js region && npm run check && npm run lint && node docs/check-links.mjs
    todos:
      - id: soak-bench
        content: Add the region version of the §1 server to bench/wp46-memory (a session per region, made with regionWith, served with enterWith, freed on eviction), keeping sessions.ts as the baseline, and teach run.mjs to run both — see soak
      - id: soak-test
        content: Add tests/link/region_sessions_soak — 2,000,000 GET /s/<id> requests through one keep-alive Http1Connection, checkpoints that read Arena.mark() and anonymous resident memory, PASS lines asserting both flat past warm-up within a stated bound, and a negative check that the test can fail — see soak
      - id: soak-measure
        content: Measure baseline vs regions at 1,000 and 100,000 live over 2,000,000 requests (memory per checkpoint, ns/request with a noise band) and put the table in docs/wp46-long-running-memory.md §7 and its status line — see soak
      - id: soak-n9
        content: Close the per-match half of WP34 N9 in docs/wp34-hosting-cs.md (the §N9 text and the N9 row), pointing at the soak — see soak
      - id: soak-roadmap
        content: Tick stage 3 on docs/roadmap/wp46-long-running-memory.md (4 of 4, state Done, Next emptied) and update docs/roadmap/index.md's WP46 row and Up next list — see soak
---

# WP46 — finish it

WP46's page ([`docs/roadmap/wp46-long-running-memory.md`](../../docs/roadmap/wp46-long-running-memory.md)) is 3 of 4. Stages 1 and 2 (the runtime regions and `nish:region` with NL2609–NL2618) and child regions (#1357) are on `main`. The only open item is stage 3, the proof, specified in [`docs/wp46-long-running-memory.md`](../../docs/wp46-long-running-memory.md) §7:

> The §1 server rewritten with regions, as a `tests/link` soak that reads `Arena.mark()` and anonymous resident memory flat across 2,000,000 requests, and WP34 N9's game-server note closed. Files: `bench/wp46-memory/`, `tests/link/`, `docs/wp34-hosting-cs.md`.

It is one chain (the server, its soak, its figures, the docs that cite them), one PR's worth, so it is one stage.

## soak

**Owns:** `bench/wp46-memory/**`, `tests/link/region_sessions_soak/**`, `docs/wp46-long-running-memory.md`, `docs/wp34-hosting-cs.md` (the §N9 section and the N9 row only), `docs/roadmap/wp46-long-running-memory.md`, `docs/roadmap/index.md` (the WP46 row and the Up next line only), `tests/run.js` (only if a link case of this length needs a registration or timeout row there)

Start from `bench/wp46-memory/sessions.ts` (the baseline, which must stay as it is: it is §1's measurement) and §2.1's sketch of the `Cache` on `Region<Session>` (`regionWith` to open, `enterWith` to serve, `free` + `Map.delete` on eviction). The region version is a new file beside it; `run.mjs` runs both.

The soak is a `tests/link` case in the shape of `tests/link/net_relay_soak` and `tests/link/async_slab_flat`: constants in the program, PASS/FAIL lines and a summary in `expected.out`. It reads `Arena.mark()` (the process arena: it must not move past warm-up, since every session's bytes are in its region) and the anonymous resident set from `/proc/self/statm` at checkpoints, and asserts both flat past warm-up within a bound the test names and justifies (the relay soak uses 524,288 bytes for RSS). 2,000,000 requests at the measured 200–500 ns/request is about a second; if the case is slow enough to need a timeout row in `tests/run.js`, add one.

**The test must be able to fail.** Show it: either a checkpoint that the baseline (no regions) would trip, or a run of the same check against the baseline that reports growth — in the PR body, with the figures. An assertion that holds with or without regions is a blocking review finding.

If the soak is *not* flat — `Map.delete` leaving tombstones whose rehash allocates in the process arena, a region's handle table growing, anything — do not paper over it with a looser bound. Find the growth, say where it comes from, and if the fix is in `src/`, `runtime/` or `std/` (outside this stage's lane), open the PR as a draft naming it. That outcome is a finding about WP46, not a failure of the stage.

Measure once: baseline vs regions, 1,000 and 100,000 live, 2,000,000 requests, per the repo's `.claude/testing.md` → "A `Measured:` trailer" (interleaved runs, a noise band). The table goes into the design note's §7 / status line, and the figures into the commit's `Measured:` trailer.

N9 in `docs/wp34-hosting-cs.md`: the per-match half points at WP46 "stages 1 and 2 built"; it becomes built and proven, citing the soak. Touch only N9's lines — the wp34-finish run's `roadmap` stage owns the rest of that file and `docs/roadmap/**`, so keep the diff to the WP46 lines to keep a textual conflict small. If one happens, resolve it on update, keeping both sides.

Roadmap per [`docs/roadmap/index.md`](../../docs/roadmap/index.md) → "Picking up a work package": tick the box, Done 4 of 4, state Done, and update the index's WP46 row and the Up next list.

No `src/`, `std/` or `runtime/` change is expected, so no goldens, no nish-cmp `DECLARED` entry and no reference regeneration. If one becomes necessary, it is outside this stage — see above.

## Out of scope

`Rc<T>`, zeroing a region's chunks on `free` for a `Secret` root, moving `std/net`'s slot pools to regions, H1-3's region per connection (§"Not in this work package"). Any compiler, runtime or `std/` change.

## Verification

The stage's `verification` line; the full suite is CI's eight shards. `docs/check-links.mjs` and `npm run lint` cover the doc edits.
