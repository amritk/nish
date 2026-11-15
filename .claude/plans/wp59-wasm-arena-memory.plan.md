---
name: WP59 — the wasm arena in a second, unexported memory (proposal, docs only)
overview: WH-10 bounds every pointer and length the root-storage trace reads, but a page that holds the module's one memory can still forge a pointer inside the arena. Propose a work package that keeps the program's memory (arena, stack, static data, roots, descriptors) as memory 0, unexported, and adds after wasm-ld a memory 1, exported as `memory`, holding a mirror of exported module storage and an exchange area for the values that cross. This PR writes the design note and roadmap page and changes no compiler code.
stages:
  - id: s1-proposal
    title: S1 — the WP59 proposal (docs only)
    goal: docs/wp59-wasm-arena-memory.md and docs/roadmap/wp59-wasm-arena-memory.md exist, every claim about the compiler checked at d38a94b0 and every toolchain claim tried under LLVM 18, registered in the indexes, with WH-10 and WP50/WP55 pointing at it.
    verification: npm run lint && node docs/check-links.mjs && npm run lint:dead && node scripts/gen-reference.mjs --check
    todos:
      - id: research-memory-users
        content: List every JavaScript reader of the module's memory (loader crossings, host-import strings and windows, panic text, views(), rings) and what else the page can write (stack, runtime state, root tables, trace descriptors) — see S1 — the WP59 proposal
        status: completed
      - id: research-toolchain
        content: Try multi-memory under LLVM 18 (address spaces, clang attribute, llvm-mc memory indices, intrinsics, inline asm, wasm-ld) and a post-link rewrite, run under Node 22 and 24 and Chromium — see S1 — the WP59 proposal
        status: completed
      - id: research-engines
        content: The engine table from WebAssembly features.json and web-features, Safari's state, the Node floor and CI pin — see S1 — the WP59 proposal
        status: completed
      - id: design-note
        content: Write docs/wp59-wasm-arena-memory.md in the shape of docs/wp57-module-scoped-names.md — see S1 — the WP59 proposal
        status: completed
      - id: roadmap-page
        content: Write docs/roadmap/wp59-wasm-arena-memory.md, four unticked stages, S3 ending in *(owner's decisions)*; its index row, scalar route, MASTER_PLAN and README rows — see S1 — the WP59 proposal
        status: completed
      - id: pointers
        content: WH-10's row and "A forged kept graph is refused" in docs/security/wasm-host.md point at WP59 and stay Fixed; a forward pointer in docs/wp55-persistent-root.md and docs/wp50-wasm-host.md §6 — see S1 — the WP59 proposal
        status: completed
---

# WP59 — the wasm arena in a second, unexported memory (proposal)

## S1 — the WP59 proposal

Owns: `docs/wp59-wasm-arena-memory.md`, `docs/roadmap/wp59-wasm-arena-memory.md`,
`docs/roadmap/index.md`, `scalar.config.json`, `docs/MASTER_PLAN.md`,
`docs/README.md`, `docs/security/wasm-host.md`, `docs/wp55-persistent-root.md`,
`docs/wp50-wasm-host.md`, `.claude/plans/wp59-wasm-arena-memory.plan.md`.

One PR, docs only. No file under `src/`, `std/`, `runtime/` or `tests/`
changes.

Toolchain verdict: LLVM 18 loads and stores only memory 0 (an address space
lowers to memory 0 silently, and `llvm-mc` refuses a memory index on a load),
and `wasm-ld` declares one memory. `memory.copy`, `memory.size` and inline
assembly do reach memory 1, and a post-link rewrite that adds a memory and
moves the `memory` export runs under Node 22, Node 24 and Chromium. So the
program's memory stays index 0 and is hidden, and the page's memory is the
one added.

The note proposes four stages:

- S1, the second memory behind a build flag;
- S2, every crossing through the exchange area;
- S3, the default, the Safari fallback, the rewritten forge test and the
  budget, waiting on the owner;
- S4, the security record that closes WH-10's "what stays".
