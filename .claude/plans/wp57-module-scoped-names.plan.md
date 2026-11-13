---
name: WP57 — module-scoped names (proposal, docs only)
overview: A function name must be unique across the whole program, exported or not, because the root package's symbol prefix is empty and analyzeFunctions keys attributes by symbol. Propose a work package that qualifies a private function's or generic template's symbol with its module path only when it would clash (S1), sets out the owner's options for exported names that clash inside one package (S2), and sizes module-scoped class and interface names (S3). This PR writes the design note and roadmap page and changes no compiler code.
stages:
  - id: s1-proposal
    title: S1 — the WP57 proposal (docs only)
    goal: docs/wp57-module-scoped-names.md and docs/roadmap/wp57-module-scoped-names.md exist, every claim about the compiler checked against src/, and every doc that states the uniqueness rule links to the note without changing the rule.
    verification: npm run lint && node docs/check-links.mjs && node scripts/gen-reference.mjs --check
    todos:
      - id: verify-claims
        content: Check each claim in the brief against src/ (nameTaken, analyzeFunctions, rejectSymbolClashes, qualifySymbols, the abs$ / labs$i32 renames, the template clash check, %struct.<name> and NL3028, interop-abi exported symbols, emit-ts one module per file, the rolling freeze) and record file:function anchors — see S1 — the WP57 proposal
        status: completed
      - id: design-note
        content: Write docs/wp57-module-scoped-names.md in the shape of docs/wp21-packages.md — problem, what exists today, S1/S2/S3 with per-stage cost (files, tests added or flipped, IR moves or not, release note), S2's options, what is not planned, the compiler's own benefit one release after S1 — see S1 — the WP57 proposal
        status: completed
      - id: roadmap-page
        content: Write docs/roadmap/wp57-module-scoped-names.md in the shape of docs/roadmap/wp21-packages.md, three unticked stages, S2 ending in *(owner's decision)* — see S1 — the WP57 proposal
        status: completed
      - id: indexes
        content: Add WP57 to docs/roadmap/index.md "In progress and proposed" (not "Up next"), its route in scalar.config.json, its row in docs/README.md and docs/MASTER_PLAN.md — see S1 — the WP57 proposal
        status: completed
      - id: rule-pointers
        content: Link the note from every doc that states the uniqueness rule (LANGUAGE.md, wp5-modules.md, guide/language/modules.md, AI.md, ARCHITECTURE.md and any other grep finds) without changing the rule's wording — see S1 — the WP57 proposal
        status: completed
---

# WP57 — module-scoped names (proposal)

## S1 — the WP57 proposal

Owns: `docs/wp57-module-scoped-names.md`, `docs/roadmap/wp57-module-scoped-names.md`,
`docs/roadmap/index.md`, `docs/README.md`, `docs/MASTER_PLAN.md`,
`scalar.config.json`, `docs/LANGUAGE.md`, `docs/wp5-modules.md`,
`docs/guide/language/modules.md`, `docs/AI.md`, `docs/ARCHITECTURE.md`,
`docs/wp15-performance.md`, `docs/wp26-stdlib.md`, `docs/wp21-packages.md`,
`.claude/plans/wp57-module-scoped-names.plan.md`.

One PR, docs only. No file under `src/`, `std/`, `runtime/` or `tests/`
changes. The note proposes:

- **S1** — private functions and generic templates take a module-path
  qualifier on their symbol only when the bare symbol would clash; clash
  checks run over the qualified symbols. `tests/link/duplicate_internal`
  turns positive, `duplicate_export` stays negative, and a new link test
  modelled on `two_packages` proves each call reaches its own helper by exit
  code. Moves: the LANGUAGE.md rule, ARCHITECTURE.md's `--strict-exports`
  bullet, wp5-modules.md, the guide page, the debugger/profiler names of a
  `spawn` task.
- **S2** *(owner's decision)* — exported names that clash inside one package
  and are not on the C surface; the options and their costs.
- **S3** — module-scoped class and interface names with type identity
  (module, name), sized across the type table, struct emission, `Owner.method`
  symbols, interop headers, `.d.ts`, N-API and JSON output.

Not planned: versions in a symbol's identity; always qualifying every symbol.
