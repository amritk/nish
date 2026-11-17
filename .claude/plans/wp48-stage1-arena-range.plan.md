---
name: WP48 stage 1 — the arena on a reserved range
overview: Put every arena chunk of 2 MiB or less on one reserved address range, carved in power-of-two size classes, in a runtime variant the compiler selects only for a program with a compact class. No program has one yet, so no IR moves and nish-cmp shows zero differences; the note's §7 records the owner's decisions.
stages:
  - id: arena-range
    title: "feat(runtime): carve the arena from a reserved range when a program has a compact class"
    goal: The range runtime exists, is selected only by a compact class (none yet), is correct under threads, regions, keep, cross-adopt, --debug-arena and ASan, and costs the ptr-range bench nothing beyond the band
    verification: npm run check && npm run lint && node tests/run.js runtime && node tests/run.js debug-arena && node tests/run.js region && node tests/run.js budget && node tests/run.js instructions && node tests/run.js c-symbols && NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js
    todos:
      - id: range-switch
        content: Add the switch — a runtime variant (-DNISH_ARENA_RANGE) that scripts/build.sh and src/run-cache.ts compile only when the compiler says a compact class exists, which in this stage is never — see The switch
        status: pending
      - id: range-reserve
        content: Reserve the range at startup — zero-based [1 GiB, 16 GiB) with MAP_FIXED_NOREPLACE on Linux, based anywhere on macOS with nish_ref_base, first 64 bytes never handed out, busy-address panic — see The reservation
        status: pending
      - id: range-carve
        content: Carve chunks up to 2 MiB in power-of-two size classes (4 KiB to 2 MiB) with a locked free list per class in nish_arena_grow, nish_free_until and runtime-region.c's free(head); exact chunks over 2 MiB stay on malloc; exhaustion panics naming the 15 GiB limit — see Carving
        status: pending
      - id: range-realign
        content: Realign off up to 8 at every C bump site under the range variant (nish_alloc_struct, nish_text_alloc, array growth in place, runtime-cross.c's two, runtime-wasm.c where it applies) and leave the inline IR bump unchanged — see The 8-byte realign
        status: pending
      - id: range-debug-asan
        content: Make --debug-arena take its never-reused reservation from the compact range when both are on, and make the ASan build ignore the range (every block stays a malloc) — see --debug-arena and ASan
        status: pending
      - id: range-tests
        content: Add the runtime unit test of the range variant under ASan and UBSan, and native round trips through build.sh with the range switched on (threads, regions, keep, cross-adopt, --debug-arena, the busy-address and exhaustion panics) — see Tests
        status: pending
      - id: range-measure
        content: Measure ptr-range against ptr and ptr-copy on bench/wp48-refs/sibling.ts (and bench/goose/tree.ts if amritk/nish#1697 has merged), and report the runtime .text budgets and the instructions ratchet in the PR body — see Measurement
        status: pending
      - id: range-docs
        content: Record the decisions in docs/wp48-ref32-classes.md §7, the range in docs/security/runtime.md, tick stage 1 on docs/roadmap/wp48-ref32-classes.md and move Next and the index row on — see Docs
        status: pending
---

# WP48 stage 1 — the arena on a reserved range

## Context

WP48's design ([`docs/wp48-ref32-classes.md`](../../docs/wp48-ref32-classes.md), §3.3, §4, §8) makes a compact class's link fields 4-byte offsets into one reserved range. Stage 1 builds only the range: the runtime that carves arena chunks from it, switched on by a compact class. No construct exists yet (stage 2 adds `implements Compact`), so in this stage nothing switches it on outside the tests, and every program's IR and default runtime are what they were.

## Decisions (the owner's answers to §7, 2026-11-17)

| §7 question | decision |
| --- | --- |
| 1. accept or decline | accepted |
| 2. who decides | the compiler picks compact classes by §3.1's rule; `implements Compact` / `implements Wide` force or refuse it (`--compact off` per build stays proposed for stage 3) |
| 3. decode shape | zero-based on Linux and Windows, based on macOS. Nish has no Windows target today (Windows is WSL), so Windows takes the zero-based shape when one exists |
| 4. what is narrowed | fields only: no locals, parameters, returns or `R[]` elements |
| 5. range size | 4-byte units: a 15 GiB range at [1 GiB, 16 GiB) |
| 6. busy fixed address | panic before `main`, naming the address and the limit (and `--compact off` once stage 3 ships it); no fallback to the based shape on Linux |

## The switch

Recommended shape, the `--debug-arena` pattern ([`src/compile.ts:2565`](../../src/compile.ts)): the range is a runtime variant compiled with `-DNISH_ARENA_RANGE`, so a program without a compact class links today's runtime object, byte for byte, with no branch added to its allocator and no `.text` moved in the default rows of [`tests/runtime-budgets.js`](../../tests/runtime-budgets.js).

- The compiler decides it from the program (a function such as `hasCompactClass(program)` that returns false until stage 2) and passes a build.sh option for it, as it passes `--debug-arena`. It is not a user CLI flag in this stage, so no guide page moves.
- [`src/run-cache.ts`](../../src/run-cache.ts) keys the variant (as it keys `--debug-arena`).
- A mismatched link must fail at link time, not at run time: the range runtime defines a symbol (for example `nish_arena_range_abi`) that stage 2's compact IR will reference. Stage 1 adds the definition and a test that links a module referencing it; no emitted IR references it yet.
- If the worker finds this shape cannot work, a different one is acceptable only if it keeps both invariants: no IR change for any program, and no instruction added to the default runtime. Say which in the PR.

## The reservation

- Linux: `mmap(1 GiB, 15 GiB, PROT_READ|PROT_WRITE, MAP_PRIVATE|MAP_ANONYMOUS|MAP_NORESERVE|MAP_FIXED_NOREPLACE)` once, before the first chunk (at startup or at the first `nish_arena_grow`, under a once-guard like `nish_debug_reserve`'s). A kernel without `MAP_FIXED_NOREPLACE` returns a different address; treat that as busy (unmap and panic), never use `MAP_FIXED`.
- macOS: the based shape, `mmap(0, 15 GiB, ...)` anywhere, its address stored in an exported `nish_ref_base` that stage 2's decode loads.
- The range's first 64 bytes are never handed out, so offset 0 stays `null`.
- Busy address (question 6): panic before `main` (at the reservation, before the first chunk is used). The message names the address and the 15 GiB limit; it names `--compact off` only once stage 3 adds the flag. No fallback to the based shape on Linux.
- New libc calls (`mmap` flags are not new symbols; anything else is) go into [`src/c-symbols.ts`](../../src/c-symbols.ts); `node tests/run.js c-symbols` says.

## Carving

- [`runtime/runtime.c`](../../runtime/runtime.c) `nish_arena_grow`: a chunk of 2 MiB or less comes from the range, rounded up to its power-of-two class (4 KiB to 2 MiB): first from that class's free list, else bumped from the range's high-water mark. Both under one lock (a chunk grab, not a per-allocation bump, so it is cold); workers share it.
- `nish_free_until` and [`runtime/runtime-region.c`](../../runtime/runtime-region.c)'s `free(head)` (about line 383) push a range chunk onto its class's list instead of `free`. A chunk C code malloc'd and linked in ([`runtime/runtime-cross.c`](../../runtime/runtime-cross.c)) is outside the range and is freed as today; tell them apart by address.
- Exact chunks over 2 MiB stay on `malloc`.
- Running out panics: `nish: the compact-class arena's 15 GiB range is used up` (exact words are the worker's), before any partial chunk is returned.
- Marks, `keep`, regions and `nish_cross_adopt` are unchanged: they link chunks, and a range chunk is a chunk.

## The 8-byte realign

Stage 2 adds 4-aligned compact instances, so in a range build every other bump must first round `off` up to 8 (one add and one and). Under `-DNISH_ARENA_RANGE` only: `nish_alloc_struct` (runtime.c), `nish_text_alloc` ([`runtime/runtime-text.c:73`](../../runtime/runtime-text.c)), runtime.c's in-place array growth if it is on `main` by then (it arrives with open PR amritk/nish#1697, which is not merged at the base; if #1697 merges while this stage is open, merge `main` and realign its new bump site too), runtime-cross.c :221 and :240. [`runtime/runtime-wasm.c`](../../runtime/runtime-wasm.c) has no range (wasm32 compresses nothing), so it is unchanged; say so in a comment. The inline `@nish_alloc_struct` in [`src/runtime.ts`](../../src/runtime.ts) is not touched in this stage: its realign is IR and belongs to stage 2, behind the compact class.

## --debug-arena and ASan

- `--debug-arena` ([`runtime/runtime.c:207-330`](../../runtime/runtime.c)) already reserves one never-reused range anywhere, 1 TiB down to 1 GiB. With both `NISH_ARENA_DEBUG` and `NISH_ARENA_RANGE`, its reservation is the compact range (fixed on Linux, based on macOS) so a stage 2 offset still decodes; it keeps its never-reuse and fault naming, and its exhaustion message names the 15 GiB limit. Size classes and free lists do not apply under the debug arena (it never reuses).
- ASan (`-DNISH_ASAN`): every block stays a malloc and the range is not reserved; `NISH_ASAN` wins over `NISH_ARENA_RANGE`. Stage 2 compiles compact classes uncompressed under ASan (§4). A comment at the `#if` says so.

## Tests

Mirror the existing runtime sections of [`tests/run.js`](../../tests/run.js) (`runtime unit test`, its ASan/UBSan rerun near line 9952, [`tests/runtime/debug-arena-test.c`](../../tests/runtime/debug-arena-test.c), [`tests/runtime/region-test.c`](../../tests/runtime/region-test.c)).

- A runtime unit test built with `-DNISH_ARENA_RANGE`, plain and under ASan and UBSan (§8). ASan's own shadow memory on x86-64 Linux sits inside [1 GiB, 16 GiB) (low shadow from 0x7fff8000, then the protected shadow gap), so the fixed range cannot be reserved in a `-fsanitize=address` process: the sanitizer run uses the based shape (a test-only define), and the plain run tests the fixed address. In it: chunks land in the range and are 4 KiB-to-2 MiB classes, a released chunk is reused by the next of its class, a >2 MiB exact chunk is outside the range, the first 64 bytes are never handed out, a region's and a worker's chunks come from the range, `keep` and `nish_cross_adopt` keep working, exhaustion panics (test with a small range under a test-only size define), and a busy fixed address panics (map the address first). Behaviour proved by the helper's exit status and stdout, not by message text (`.claude/testing.md`, "Checks that spawn a process").
- A native round trip: an existing threaded, region-using program (pick from `tests/link/`) linked through `scripts/build.sh` with the range option, the same stdout as without it.
- The same program with `--debug-arena` and the range: a stale reference still faults with the debug arena's message.
- The ASan build with the range define: reserves nothing, passes the differential ASan check it passes today.
- Link check: a module referencing the range ABI symbol links against the range runtime and fails to link against the default one.
- Show the exact LLVM IR for every TypeScript snippet the tests add (CLAUDE.md).

## Measurement

- `ptr-range` is the gate: stock IR of [`bench/wp48-refs/sibling.ts`](../../bench/wp48-refs/sibling.ts) linked against the range runtime, against `ptr` (stock) and `ptr-copy` (noise band), interleaved and shuffled, fresh process each, RSS through `bench/rss.c`, as §5 describes. It must stay within the band of `ptr`. `bench/goose/tree.ts` (n = 24) is on `main` only once amritk/nish#1697 merges; measure it too if it is there, and say so if it is not. Record the run in the note's §5 (or a new §5.4) with the command that ran it, and a `Measured:` trailer with the band.
- Runtime `.text` budgets: `node tests/run.js budget` for the default rows (must be unchanged) and the range variant's size; add a range row to [`tests/runtime-budgets.js`](../../tests/runtime-budgets.js) and [`docs/wp7-runtime.md`](../../docs/wp7-runtime.md) if the gate measures variants.
- Instructions ratchet: `node tests/run.js instructions` (bench/instructions.json) must show +0.000% for every program, since the default runtime is unchanged. Report the figures in the PR body.

## Docs

- [`docs/wp48-ref32-classes.md`](../../docs/wp48-ref32-classes.md) §7: each question's decision and date, replacing "proposed" where decided; §3.3 for anything the implementation changed.
- [`docs/security/runtime.md`](../../docs/security/runtime.md): the range is attacker-adjacent memory management: a record entry for the reservation, the size-class free lists and the exhaustion panic, with its tests; `node scripts/security-scope.mjs` passes.
- [`docs/roadmap/wp48-ref32-classes.md`](../../docs/roadmap/wp48-ref32-classes.md): tick stage 1, Done 2 of 7, Next becomes stage 2 (§3.2); its row in [`docs/roadmap/index.md`](../../docs/roadmap/index.md).
- No user-guide page moves: nothing a user sees changes in this stage.

**Owns:** `runtime/**`, `scripts/build.sh`, `src/compile.ts`, `src/run-cache.ts`, `src/c-symbols.ts`, `src/structs.ts`, `tests/run.js`, `tests/runtime-test.c`, `tests/runtime/**`, `tests/runtime-budgets.js`, `tests/link/**`, `tests/self/goldens/checked/**`, `bench/wp48-refs/**`, `docs/wp48-ref32-classes.md`, `docs/roadmap/wp48-ref32-classes.md`, `docs/roadmap/index.md`, `docs/security/runtime.md`, `docs/security/README.md`, `docs/wp7-runtime.md`, `docs/BENCHMARKS.md`

## Out of scope

`implements Compact`/`Wide`, any `i32` field, the decode or encode, `@nish_alloc_ref`, the inline bump's realign, attributes, TBAA, debug info, headers (stage 2); the rule and `--compact off` (stage 3); wasm32 layout (stage 6). Any IR change for any program: nish-cmp must show zero differences with no new `DECLARED` entry.

## Verification

```bash
npm run check
npm run lint
node tests/run.js runtime
node tests/run.js debug-arena
node tests/run.js region
node tests/run.js budget
node tests/run.js instructions
node tests/run.js c-symbols
NISH_BOOTSTRAP=build/seed/bin/nish node tests/nish-cmp.js
```

Plus, if `src/` changed: `WASI_SYSROOT=/usr node tests/run.js wasi` and `node tests/run.js performance`, and the goldens regenerated with `node tests/self/goldens.js --update`. CI's eight shards are the full gate.
