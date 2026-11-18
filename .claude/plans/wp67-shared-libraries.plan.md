---
name: WP67 — shared, faster libraries, layered like atomic design
overview: Add a work package to the roadmap that measures the code duplicated across std/ and src/ and proposes extracting it into layered, reusable libraries (atoms, molecules, organisms), with one extraction stage per cluster. This run lands the proposal only; the extractions are WP67's own stages, picked up later.
stages:
  - id: s1-wp67-note
    title: Propose WP67 — survey, layering, staged extraction
    goal: A design note and roadmap page that a later session can pick up stage by stage, grounded in a measured survey of the duplication in std/ and src/
    verification: npm run lint && npm run check && node tests/run.js scalar && node scripts/gen-reference.mjs --check
    todos:
      - id: survey-duplication
        content: Measure duplicated code across std/ and src/ into clusters with sites, line counts and divergences — see Survey
      - id: layering-model
        content: Define the atom / molecule / organism tiers, the import rule between them, and where each tier lives — see Layering
      - id: constraints
        content: Record what bounds an extraction (seed freeze, public std surface and gen-reference, nish-cmp IR moves, goldens, code size, wasm) — see Constraints
      - id: performance-first
        content: Make performance the first rule of every extraction — the shared version is the fastest copy or faster, measured, and the clusters are ranked by what a faster shared copy buys — see Performance first
      - id: modernise-on-extract
        content: Inventory the constructs and builtins that landed after each cluster's copies were written, and set the rule that an extraction rewrites in today's Nish within the seed freeze — see Modern code
      - id: staged-extraction
        content: Order the extraction stages, one cluster per stage, each with its acceptance test and the measurement it must not regress — see Stages
      - id: owner-decisions
        content: List the decisions the owner must make before S2 starts — see Decisions
      - id: roadmap-wiring
        content: Add docs/roadmap/wp67 page, its index row, its MASTER_PLAN and docs/README rows and its scalar.config.json route — see Roadmap wiring
---

## Context

[`std/`](../../std) (~164k lines, 125 files) and [`src/`](../../src) (~146k lines, 132 files) are both Nish. `src/` already imports `std/` (`std/cli`, `std/input`, `std/raster`, `std/synth`), so code can move from the compiler into the library. Small helpers recur across both: character-code constants (`TAB`, `NEWLINE`, `SLASH`, `UPPER_A`, `CH_CR`… each defined three or more times), hex-digit decoding (`std/math.ts`, `src/lexer.ts`), string quoting (eight `quote` definitions: `std/json.ts`, `std/yaml.ts`, `std/net/http1-codec.ts`, `src/context.ts`, `src/debug.ts`, …), integer bounds (`I32_MAX`), byte readers and writers in the codecs. Nothing says where a shared helper belongs, so each module writes its own.

The user's ask: add this to the plan — go through std/ and src/ and extract common code into reusable libraries, layered like atomic design. Following the repository's convention, "the plan" is the roadmap: a `docs/wpN-*.md` design note plus a `docs/roadmap/wpN-*.md` page with a box per stage (see [`f0587701`](https://github.com/amritk/nish/commit/f0587701), WP66). WP67 is the next free number; the worker re-checks open PRs for it before pushing.

## Approach

One docs-only PR, like WP66's. The extraction itself is not done here: each cluster becomes its own WP67 stage, because each one moves IR (nish-cmp `DECLARED` entries), goldens and possibly public `std/` surface, and must be measured on its own.

## Survey

A measured table, not impressions. For each cluster: what it is, every site (file:line), lines duplicated, whether the copies agree or diverge (and how — a divergence is a bug candidate or a reason it can't merge), and whether a std module already provides it. Method stated in the note (the grep/AST pass used, so it can be rerun). Cover at least: character codes and ASCII classes, hex/decimal digit decoding and encoding, string quoting and escaping (JSON, YAML, C, IR), integer bounds and overflow helpers, byte readers/writers and varints, UTF-8 encode/decode, growable byte/string builders, cursor/scanner patterns in the tokenizers (json, yaml, regex, lexer, http), and hashing. Rank clusters by the ranking in Performance first.

## Layering

The atomic-design mapping, adapted to a library:

| Tier | What | Examples | May import |
| --- | --- | --- | --- |
| atoms | constants and pure leaf functions, no allocation | char codes, ASCII classes, digit values, integer bounds | nothing |
| molecules | small data structures and codecs built from atoms | byte builder, cursor/scanner, varint, UTF-8, hex, quote/escape | atoms |
| organisms | format- or protocol-level components | tokenizers, json/yaml writers, http codec pieces | atoms, molecules |
| templates / pages | existing std modules and the compiler | `std/json.ts`, `std/net/*`, `src/*` | any lower tier |

The note decides: the directory (e.g. `std/core/` or per-tier dirs), whether lower tiers are public `std` API or internal (and how "internal" is expressed, given every public `std` declaration needs a doc comment and a reference page), and how the import rule is enforced (a lint or `tests/run.js` check that an atom imports nothing).

## Performance first

The order of priorities for every WP67 stage is **performance, then one shared copy, then modern code**. Deduplication and modernising never buy a slower program.

- **Baseline is the fastest copy.** For each cluster the survey benchmarks the existing copies against each other (a micro-benchmark per cluster under `bench/`, plus the programs that call it hottest: the compiler compiling itself, the JSON/YAML/HTTP benches) and names the fastest. The shared version starts from that one, not from the most readable one.
- **Extraction is an optimisation opportunity.** Once one copy serves every caller, it is worth tuning: table-driven ASCII classes, SIMD (`std` already has AVX2/SSE paths), branch-free digit decoding, fewer bounds checks the prover can discharge, `inline`-friendly shapes across module boundaries. The note lists, per cluster, the optimisation the shared copy should get and the measured gain it expects.
- **Ranking.** Clusters are ordered by measured performance gain first (hot paths in the compiler and the server benches), then lines saved × sites, then risk.
- **The gate.** Each stage carries a `Measured:` trailer per `.claude/testing.md` — interleaved same-machine runs with a noise band — showing no caller got slower beyond noise and naming what got faster, plus compiler self-build time and binary size. A shared version that loses to any copy it replaces on a hot path does not merge; that site keeps its copy, recorded as an exception with the figures.
- A modern construct (below) that costs time is not used; the note says which constructs were measured and how they compared.

## Modern code

Much of the duplicated code predates the constructs it would use if written today. An extraction is the moment to rewrite it in current Nish, not to copy it. The note: (a) lists the language constructs and builtins that landed since each cluster's oldest copy (from `CHANGELOG.md`, `docs/LANGUAGE.md` and `git log -S` on the sites): e.g. generics, generics over unions, arrow-function declarations, `Map`, string enums, destructuring declarations, `for…of`/foreach, function references, `Result`, ranged integers, typed JSON, SIMD helpers, whichever apply; (b) per cluster, names the modern form the shared version uses and what it replaces (a hand-rolled table, a manual loop, a sentinel return); (c) states the rule each extraction stage follows: write the shared module in the most current Nish the code's consumers allow. For anything `src/` imports, that is what the **seed** compiles (the rolling freeze), so a construct newer than the last release waits for the next one, and the note marks which clusters are blocked on that; (d) requires the stage to show the rewrite does not regress IR size or the benchmark table, since a modern form is not automatically as cheap as the hand-written one.

## Constraints

- **Rolling freeze**: `src/` is built by the seed, so a module it imports must compile under the last release; it may not use a construct newer than the seed.
- **Public surface**: a new public `std/` declaration needs JSDoc (`scripts/gen-reference.mjs --check`, `scripts/undocumented.txt` only shrinks) and a `docs/reference/` page and guide update.
- **IR moves**: any change that moves a nish-cmp corpus program's IR needs `DECLARED` entries in `tests/nish-cmp.js`; goldens in `tests/self/goldens/checked/` regenerate.
- **Cost**: code size (`scripts/size-report.sh`), the benchmark table, inlining across module boundaries, wasm builds; an extraction must not regress them beyond the noise band.
- **Security**: moving code in or out of `std/crypto` / `std/net` moves its `docs/security/` scope; secret-handling helpers keep `Secret<T>` and wipes.

## Stages

S1 is this note. S2 onward: one cluster per stage, ordered by Performance first's ranking (atoms before what builds on them), each with its sites, its baseline (the fastest copy and its figures), the optimisation it gets, the modern form it is rewritten in (see Modern code), its acceptance test (the copies deleted, every caller importing the shared one, an import-rule check), and the measurement it must not regress. Mark which stages can run in parallel.

## Decisions

The owner's calls before S2, numbered D1…: the directory and naming, public vs internal tiers, whether `src/` may depend on lower tiers directly, whether divergent copies are unified (behaviour change) or kept, and the enforcement mechanism.

## Roadmap wiring

Mirror WP66's PR (`git show --stat f0587701`): `docs/wp67-<name>.md`, `docs/roadmap/wp67-<name>.md` (State: Proposed, Done 0 of N, Stages, Next, Open questions, Not planned), a row in [`docs/roadmap/index.md`](../../docs/roadmap/index.md) "In progress and proposed" and its Open questions list, a row in [`docs/MASTER_PLAN.md`](../../docs/MASTER_PLAN.md) and [`docs/README.md`](../../docs/README.md), and the route in [`scalar.config.json`](../../scalar.config.json).

Owns: `docs/wp67-*.md`, `docs/roadmap/wp67-*.md`, `docs/roadmap/index.md`, `docs/MASTER_PLAN.md`, `docs/README.md`, `scalar.config.json`

## Out of scope

Moving any code. Changes to `std/`, `src/`, `tests/`, `runtime/`. Those are WP67's S2+.

## Verification

`npm run lint`, `npm run check`, `node tests/run.js scalar` (site routes), `node scripts/gen-reference.mjs --check`, then CI green. Every figure in the survey is reproducible from the method the note states.
