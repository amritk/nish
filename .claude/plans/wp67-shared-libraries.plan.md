---
name: WP67 — shared libraries, layered like atomic design
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

A measured table, not impressions. For each cluster: what it is, every site (file:line), lines duplicated, whether the copies agree or diverge (and how — a divergence is a bug candidate or a reason it can't merge), and whether a std module already provides it. Method stated in the note (the grep/AST pass used, so it can be rerun). Cover at least: character codes and ASCII classes, hex/decimal digit decoding and encoding, string quoting and escaping (JSON, YAML, C, IR), integer bounds and overflow helpers, byte readers/writers and varints, UTF-8 encode/decode, growable byte/string builders, cursor/scanner patterns in the tokenizers (json, yaml, regex, lexer, http), and hashing. Rank clusters by lines saved × sites × risk.

## Layering

The atomic-design mapping, adapted to a library:

| Tier | What | Examples | May import |
| --- | --- | --- | --- |
| atoms | constants and pure leaf functions, no allocation | char codes, ASCII classes, digit values, integer bounds | nothing |
| molecules | small data structures and codecs built from atoms | byte builder, cursor/scanner, varint, UTF-8, hex, quote/escape | atoms |
| organisms | format- or protocol-level components | tokenizers, json/yaml writers, http codec pieces | atoms, molecules |
| templates / pages | existing std modules and the compiler | `std/json.ts`, `std/net/*`, `src/*` | any lower tier |

The note decides: the directory (e.g. `std/core/` or per-tier dirs), whether lower tiers are public `std` API or internal (and how "internal" is expressed, given every public `std` declaration needs a doc comment and a reference page), and how the import rule is enforced (a lint or `tests/run.js` check that an atom imports nothing).

## Constraints

- **Rolling freeze**: `src/` is built by the seed, so a module it imports must compile under the last release; it may not use a construct newer than the seed.
- **Public surface**: a new public `std/` declaration needs JSDoc (`scripts/gen-reference.mjs --check`, `scripts/undocumented.txt` only shrinks) and a `docs/reference/` page and guide update.
- **IR moves**: any change that moves a nish-cmp corpus program's IR needs `DECLARED` entries in `tests/nish-cmp.js`; goldens in `tests/self/goldens/checked/` regenerate.
- **Cost**: code size (`scripts/size-report.sh`), the benchmark table, inlining across module boundaries, wasm builds; an extraction must not regress them beyond the noise band.
- **Security**: moving code in or out of `std/crypto` / `std/net` moves its `docs/security/` scope; secret-handling helpers keep `Secret<T>` and wipes.

## Stages

S1 is this note. S2 onward: one cluster per stage, atoms first (they have no dependencies), each with its sites, its acceptance test (the copies deleted, every caller importing the shared one, an import-rule check), and the measurement it must not regress. Mark which stages can run in parallel.

## Decisions

The owner's calls before S2, numbered D1…: the directory and naming, public vs internal tiers, whether `src/` may depend on lower tiers directly, whether divergent copies are unified (behaviour change) or kept, and the enforcement mechanism.

## Roadmap wiring

Mirror WP66's PR (`git show --stat f0587701`): `docs/wp67-<name>.md`, `docs/roadmap/wp67-<name>.md` (State: Proposed, Done 0 of N, Stages, Next, Open questions, Not planned), a row in [`docs/roadmap/index.md`](../../docs/roadmap/index.md) "In progress and proposed" and its Open questions list, a row in [`docs/MASTER_PLAN.md`](../../docs/MASTER_PLAN.md) and [`docs/README.md`](../../docs/README.md), and the route in [`scalar.config.json`](../../scalar.config.json).

Owns: `docs/wp67-*.md`, `docs/roadmap/wp67-*.md`, `docs/roadmap/index.md`, `docs/MASTER_PLAN.md`, `docs/README.md`, `scalar.config.json`

## Out of scope

Moving any code. Changes to `std/`, `src/`, `tests/`, `runtime/`. Those are WP67's S2+.

## Verification

`npm run lint`, `npm run check`, `node tests/run.js scalar` (site routes), `node scripts/gen-reference.mjs --check`, then CI green. Every figure in the survey is reproducible from the method the note states.
