---
name: WP59 — the wasm arena in a second, unexported memory (design page)
overview: Draft the work-package page and design note for the structural fix WH-10's disposition names — keep the arena, the kept graph and root storage in a second wasm memory the module never exports, so a page cannot forge a pointer into them. Docs only, no code; one PR, docs(roadmap).
stages:
  - id: s1-wp59-page
    title: "docs(roadmap): propose WP59, the wasm arena in a second, unexported memory"
    goal: WP59 is proposed on main — a design note, a roadmap page, its index row and site route — answering every question the requirements list, with each factual claim (views()/rings, toolchain, engines) backed by a cited line or a run experiment.
    verification: npm run lint && node docs/check-links.mjs && npm run lint:dead && node scripts/gen-reference.mjs --check
    todos:
      - id: research-memory-users
        content: Map every place the wasm32 module's memory is read or written from outside — views(), the rings (std/host/ring.ts, runtime/page.mjs ringOver), module storage, the loader's string/array copies (src/interop-wasm.ts), panic text, host import windows — and every place src/ emits a wasm load/store and which memory index it uses (wide read to an Explore subagent, model sonnet). Verify or correct the WH-10 claim that views() and the rings do not need the arena — see Research
        status: pending
      - id: research-toolchain
        content: Check by experiment whether the pinned LLVM 18 clang/llc/wasm-ld (and the CI pin in .github/workflows/ci.yml) accept multi-memory — address spaces in IR, -mattr=+multimemory, wasm-ld linking a second memory, an unexported memory — and record the exact commands and outputs; if unsupported, name the fallback — see Research
        status: pending
      - id: research-engines
        content: Record multi-memory support with versions and sources for Node (the version CI pins and the minimum the package supports), Chrome, Firefox, Safari, wasmtime, and the wasi profile's runtime; decide whether a single-memory fallback build is needed — see Research
        status: pending
      - id: design-note
        content: Write docs/wp59-wasm-arena-memory.md — the problem (WH-10 what-stays), memory 0 vs memory 1 split, codegen's memory choice per pointer, crossings and their copy cost, engine support and fallback, the rolling freeze, staged deliverables each with tests (forged in-arena pointer impossible; perf/size budget measured like #1571, graph drive interleaved with a noise band), the security-record stage that closes WH-10's what-stays, and open questions — see Design note
        status: pending
      - id: roadmap-page
        content: Write docs/roadmap/wp59-wasm-arena-memory.md in the WP57 page format (State Proposed, Done 0 of N, Stages, Next, Not planned), add its row to docs/roadmap/index.md "In progress and proposed", its route in scalar.config.json, and the MASTER_PLAN.md / docs/README.md lines the WP57 proposal (#1562) added for its package — see Registration
        status: pending
      - id: pointers
        content: Point WH-10's disposition in docs/security/wasm-host.md (and the property "A forged kept graph is refused") at WP59 without changing its Fixed state, and add a one-line forward pointer from docs/wp55-persistent-root.md; add .claude/plans/wp59-wasm-arena-memory.plan.md for the package's own stages as WP56/WP57 did — see Registration
        status: pending
---

# WP59 — the wasm arena in a second, unexported memory (design page)

## Context

WH-10 (docs/security/wasm-host.md, the row at line 125) was fixed in #1571
(14a35fcf) by bounding the root-storage trace in runtime/runtime-wasm.c
(`nish_area_end`, `nish_slot`, `nish_visit`): every pointer is held to the
arena (or static data for a string) and every length to its block. What stays
open: a page can forge a pointer that lands *inside* the arena and scramble its
own kept graph, because the page owns the exported memory. The disposition names
the structural fix: a second wasm memory the module does not export, holding the
arena, the kept graph and root storage, "which `views()` and the rings do not
need". That claim must be verified, not assumed.

This run produces the proposal only. No file under src/, std/, runtime/ or
tests/ changes.

## Stage s1-wp59-page

**Owns:** `docs/wp59-wasm-arena-memory.md`, `docs/roadmap/wp59-wasm-arena-memory.md`, `docs/roadmap/index.md`, `scalar.config.json`, `docs/MASTER_PLAN.md`, `docs/README.md`, `docs/security/wasm-host.md`, `docs/wp55-persistent-root.md`, `docs/wp50-wasm-host.md`, `.claude/plans/wp59-wasm-arena-memory.plan.md`

One stage: the research and the page are a chain (the page states what the
research found), and the whole is one PR's worth of docs.

### Research

Read first: CLAUDE.md, .claude/orientation.md, .claude/architecture.md;
docs/roadmap/index.md "Picking up a work package"; docs/security/wasm-host.md
(WH-10 row and "A forged kept graph is refused"); docs/wp55-persistent-root.md;
docs/wp50-wasm-host.md (the page-reportable panic path); runtime/runtime-wasm.c
in parts. Send the wide read of how src/ emits wasm loads and stores, and the
memory index each uses, to an Explore subagent (model sonnet).

Every factual claim the note makes about the toolchain or engines carries its
evidence: the command and its output for the toolchain (LLVM 18 is installed
in the container: clang, llc, wasm-ld), a cited source with a version for an
engine. Where the evidence could not be obtained, the note says so rather than
guessing.

### Design note

docs/wp59-wasm-arena-memory.md must cover:

- What moves to memory 1 and what stays in memory 0 — exported views, rings,
  strings handed to the page, static data, module storage, the stack, the
  page-visible panic message — with the reason for each.
- How codegen picks the memory per pointer: LLVM address spaces for wasm
  multi-memory, whether the pinned clang/wasm-ld support it, and what to do if
  they do not (e.g. post-link rewrite, a newer pin, or a different split).
- How strings and arrays cross from memory 1 into the page's view: the copies,
  where they happen (loader vs module), and what they cost.
- Engine support: Node, Chrome, Firefox, Safari, wasmtime; the wasi profile;
  whether a single-memory fallback build is needed and what it gives up.
- The rolling freeze: src/ may not use a new construct until the next release
  ships it — which stages that constrains and how.
- Staged deliverables, each with its tests: a test that a forged in-arena
  pointer is impossible because the page has no handle to the arena (the WH-10
  forge test rewritten against the new layout); a perf/size budget measured as
  #1571 measured (graph drive, interleaved, with a noise band).
- The security-record stage: WH-10's "what stays" closes and the property is
  restated.

### Registration

The WP57 proposal (#1562, 8d600a22) is the template for which files a proposal
touches. WH-10's state stays **Fixed**; its row gains a pointer to WP59 as the
structural fix, nothing more.
