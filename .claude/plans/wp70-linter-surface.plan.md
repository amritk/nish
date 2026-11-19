---
name: WP70 — the surface a Spectral-compatible linter asks for
overview: A JSON/YAML linter written in Nish takes Spectral's inputs and reports what Spectral reports, vacuum's behaviour an option where cheap. The language needs nothing new; std needs JSON with source ranges and jsonc-parser's recovery, YAML loaded as Spectral loads it, UTF-16 columns, collation and code point order, and globs in fast-glob's and minimatch's dialects. nish/regex stays as it is; the linter rewrites and reports instead.
stages:
  - id: s0-proposal
    title: S0 — the WP70 proposal (docs only)
    goal: docs/wp70-linter-surface.md and docs/roadmap/wp70-linter-surface.md exist, every claim anchored at d0f446d1 or a pinned upstream commit, registered in the indexes.
    verification: npm run lint && node docs/check-links.mjs
    todos:
      - id: research-upstream
        content: Read Spectral's parsers, @stoplight/json, @stoplight/yaml, yaml-ast-parser, alphabetical, minimatch use and CLI glob, and vacuum's alphabetical, at their pinned commits — see S0
        status: completed
      - id: design-note
        content: Write the design note, §1 to §9 — see S0
        status: completed
      - id: roadmap-page
        content: Roadmap page with six unticked stages, the index row, the scalar route, MASTER_PLAN and docs/README rows — see S0
        status: completed
  - id: s1-json-ranges
    title: S1 — JSON with source ranges
    goal: A loader that parses JSON into a JsonDocument calling setRange and setKeyRange for every value and key in the tokenizer's one pass, ranges equal to jsonc-parser's; its cost measured against a plain parse.
    verification: node tests/run.js json && npm run check && npm run lint && node scripts/gen-reference.mjs --check
    todos:
      - id: s1-loader
        content: The loader and a range differential against jsonc-parser — see docs/wp70-linter-surface.md §1
        status: pending
  - id: s2-json-recovery
    title: S2 — jsonc-parser's recovery, as @stoplight/json drives it
    goal: The same errors at the same offsets and lengths and the same partial tree as jsonc-parser 2.2; comments accepted as an option; duplicate keys reported at the repeated key, last value kept; a caller-set depth limit.
    verification: node tests/run.js json && npm run lint && node scripts/gen-reference.mjs --check
    todos:
      - id: s2-differential
        content: The broken-document corpus and the differential against jsonc-parser 2.2 — see §2
        status: pending
      - id: s2-security
        content: The new entry point in docs/security/json.md — see §2
        status: pending
  - id: s3-yaml
    title: S3 — YAML as Spectral loads it
    goal: Two YamlJsonLoader options, off by default; non-finite numbers load with JavaScript's comparisons and equality, write as null, keep their anchor's range through aliases and merges; non-string keys spelled as String() of their resolved value.
    verification: node tests/run.js yaml && node tests/run.js json && npm run lint && node scripts/gen-reference.mjs --check
    todos:
      - id: s3-nonfinite
        content: The non-finite option and what isI64, isIntegral, jsonEqual, jsonNumberCompare and JsonWriter answer — see §3
        status: pending
      - id: s3-keys
        content: The resolved-key option, big integers exact — see §3
        status: pending
      - id: s3-pins
        content: Regenerate pinned std/yaml-json.ts and std/json-*.ts LINE:COL references — see CLAUDE.md
        status: pending
  - id: s4-columns
    title: S4 — zero-based lines and UTF-16 columns
    goal: utf16Column and zero-based accessors on YamlLineIndex, no costlier than column.
    verification: node tests/run.js yaml && npm run lint && node scripts/gen-reference.mjs --check
    todos:
      - id: s4-index
        content: The accessors and tests with astral characters, CR LF, lone CR, offsets past the end and inside a sequence — see §4
        status: pending
  - id: s5-collate
    title: S5 — std/collate.ts
    goal: collateCompare (UCA, CLDR root, tertiary, non-ignorable, pinned to en, equal to Node's localeCompare(b, "en")) and compareCodePoints; tables generated from the CLDR release in the ICU of the Node ci.yml pins.
    verification: node tests/run.js collate && npm run check && npm run lint && node scripts/gen-reference.mjs --check
    todos:
      - id: s5-tables
        content: The generator script with a pinned hash, the ASCII fast path, the size a program carries — see §5
        status: pending
      - id: s5-tests
        content: CollationTest_CLDR_NON_IGNORABLE and the Node differential; the licence in THIRD_PARTY_NOTICES.md — see §5
        status: pending
  - id: s6-glob
    title: S6 — std/glob.ts
    goal: fast-glob 3.2's and minimatch 3's dialects with matchBase, linear matching, expansion with readdirSync under fs.read only, no symlink loops, fast-glob's order.
    verification: node tests/run.js glob && npm run check && npm run lint && node scripts/gen-reference.mjs --check
    todos:
      - id: s6-matcher
        content: The matcher in both dialects and its differentials against fast-glob 3.2.12 and minimatch 3.1 — see §6
        status: pending
      - id: s6-expand
        content: Expansion and its capability test — see §6
        status: pending
---

# WP70 — the surface a Spectral-compatible linter asks for (plan)

## S0 — the WP70 proposal

Owns: `docs/wp70-linter-surface.md`, `docs/roadmap/wp70-linter-surface.md`,
`docs/roadmap/index.md`, `scalar.config.json`, `docs/MASTER_PLAN.md`,
`docs/README.md`, and this plan.

One PR, docs only, shared with WP69's proposal. No file under `src/`, `std/`,
`runtime/`, `tests/` or `bench/` changes.

## S1 to S6

Each stage is specified in the design note and lands in its own PR that ticks
its box on the roadmap page. S1 comes before S2; S3 to S6 depend on nothing
here and none waits on WP69.
