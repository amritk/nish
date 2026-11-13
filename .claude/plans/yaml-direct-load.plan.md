---
name: YAML straight into a JsonDocument — one tree, not two
overview: Loading YAML into a JsonDocument today parses the whole text into a YamlStream (std/yaml.ts) and then YamlJsonLoader.load (std/yaml-json.ts) walks that tree and builds a second one in JsonDocument (std/json-value.ts). On bench/yaml-json's 1.1 MB OpenAPI fixture parse alone is 18.7 ms and parse plus load 36.3 ms (1.94x). This plan adds a direct path that builds the JsonDocument while the text is parsed, so a load pays for one tree, and keeps the existing load(stream, d, doc) unchanged beside it. One stage, one PR — the parser mode, the in-document copy and the loader are one chain.
stages:
  - id: direct-load
    title: "perf(yaml): load YAML text straight into a JsonDocument, without the YamlStream tree"
    goal: A new nish/yaml-json entry point loads document d of a YAML text into a JsonDocument in the parse itself, with every value, range and refusal identical to load(parseYaml(text), d, doc), measurably faster than that pair on bench/yaml-json and without slowing parseYaml
    verification: npm run check && npm run lint && node tests/run.js std_yaml && node tests/run.js yaml-compare && node tests/run.js wasi && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs && node docs/check-links.mjs && node bench/yaml-json/run.mjs
    status: pending
    todos:
      - id: profile-first
        content: Before changing code, build bench/yaml-json with --profile speed and take a cachegrind (or perf) profile of the load workload; record where the 17.6 ms load step goes (YamlStream build, re-decoding of keys and scalars, the count pass, JsonDocument appends, ranges) and keep that table for the PR body — see Design, Profile first
        status: pending
      - id: json-copy
        content: Add an internal deep copy of an already-built value inside one JsonDocument (values, member slots, key and string bytes, ranges kept, the copy's root range overridable), charged to maxValues and maxTotalBytes, so an alias is expanded by copying the anchored JSON value instead of re-walking YAML nodes — see Design, Aliases
        status: pending
      - id: parser-sink
        content: Give YamlParser a direct-build mode, off by default, in which each completed node (scalar, pair, finished collection — the parser is already post-order) also emits its JsonDocument value; keep only the node store the parser's inline checks read (anchors, merge verdicts, duplicate keys) and decode each scalar and key once — see Design, The parser mode
        status: pending
      - id: loader-entry
        content: Add the public entry point in std/yaml-json.ts (name it in the YamlJsonLoader / yamlJson* style, e.g. loader.loadText(text, d, doc) or a parseYaml-options variant), with merges applied at map completion (own keys first), the JSON-level duplicate policy, depth, byte and value caps, and identical error codes and ranges — on any failure it may re-run the two-tree path to produce the exact refusal — see Design, Identical results
        status: pending
      - id: differential-test
        content: Add a link test that, for every yaml-test-suite case in tests/yaml-suite/cases.txt and every input std_yaml_json already uses, checks the direct path against load(parseYaml(text), d, doc) — same written JSON, same value and key ranges, same code and error range — plus negative tests for an alias bomb, a merge budget overrun, a too-deep document and a byte-cap overrun on the direct path — see Design, Tests
        status: pending
      - id: bench
        content: Add a `direct` workload to bench/yaml-json (main.ts and run.mjs), run it interleaved against parse and load, and record the before/after table with its noise band in bench/README.md and docs/BENCHMARKS.md if it carries a YAML row — see Design, Measuring
        status: pending
      - id: docs
        content: Document the entry point (doc comment with @param/@returns), its row in std/README.md, the "Loading YAML into a JsonDocument" section of docs/guide/using-nish/standard-library.md (switch the example to the one-call path), regenerate docs/reference with node scripts/gen-reference.mjs, and update docs/security/yaml.md's scope and findings for the new functions — see Design, Docs and security
        status: pending
      - id: generated
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update, run nish-cmp and add narrow DECLARED entries to tests/nish-cmp.js for every corpus program whose IR moves (yaml.ll, yaml-json.ll, json-value.ll users)
        status: pending
---

# YAML straight into a JsonDocument

## Why

`YamlJsonLoader.load` reads a finished `YamlStream`. The stream is a
struct-of-arrays tree (`std/yaml.ts`, `YamlStream`, one `newNode` allocator,
children completed before parents), and the loader then walks it a second time:
it counts the alias expansion, decodes every scalar again (`stream.type` then
`stream.text`, two scans), decodes every key again (`keyText`, already decoded
once by the parser's `trackKey`), checks duplicates again, and builds a second
tree in `JsonDocument`. Only part of that is intrinsic. A direct build still has
to decode each scalar once, normalise numbers, create values and ranges, apply
merges, expand aliases and enforce the caps; it does not have to build and walk
the whole `YamlStream`.

## Stage `direct-load`

**Owns:** `std/yaml.ts`, `std/yaml-json.ts`, `std/json-value.ts`, `std/README.md`,
`tests/link/std_yaml*/**`, `tests/yaml-suite/**`, `bench/yaml-json/**`,
`bench/README.md`, `docs/BENCHMARKS.md`, `docs/guide/using-nish/standard-library.md`,
`docs/reference/**`, `scalar.config.json`, `docs/security/yaml.md`,
`docs/security/README.md`, `tests/nish-cmp.js`, `tests/self/goldens/checked/**`,
`scripts/undocumented.txt`

## Design

**Profile first.** The 17.6 ms load step is a measurement, not yet a profile.
Take one before writing code (`.claude/testing.md`, and the bench's own
cachegrind recipe in `bench/README.md` → "Loading YAML into a JsonDocument"), so
the PR can say which costs the direct path removes and which remain intrinsic.

**The parser mode.** Nish interfaces carry fields only and there is no dynamic
dispatch (`docs/LANGUAGE.md`), so a generic sink is not available: the parser
gets a mode field, tested at its node-completion points (`newNode` call sites,
`makePair`, `finishCollection`). The default `parseYaml` path must not slow
down: the `parse` workload and `yaml-compare` stay inside their noise bands.
The parser's inline checks (`scanAlias`, `attachProps`, `trackKey`,
`checkMerge`) read nodes back, so the direct mode keeps the minimal node store
they need; decoded key text from `trackKey` is reused for the JSON key rather
than decoded again.

**Aliases.** An anchor is defined after its node's subtree is built, so its
JSON value exists when any alias to it is read. Expand an alias by copying that
value inside the `JsonDocument` (new internal copy, todo `json-copy`), giving
the copy's root the alias's range and keeping the anchored ranges inside it, as
`load` does today. Alias-bomb protection: each built value's size is known, so
the expansion is charged before each copy is made and never built past
`maxValues`/`maxTotalBytes`.

**Identical results.** For every input the direct path answers what
`load(parseYaml(text), d, doc)` answers: the same values in the same order,
the same ranges, the same code with the same `errorStart`/`errorEnd`. Where the
direct path cannot cheaply know the two-tree answer's error location (for
example which alias `count` would blame first in a bomb), it may stop, clear
the document, and re-run the two-tree path to produce the refusal: failures
are the rare path and need not be fast, but they must not build past the caps.

**Tests.** The existing `std_yaml_json` expected output stays byte-identical
(the old API is unchanged). The new differential test runs both paths over
every yaml-test-suite case and every `std_yaml_json` input and compares them
in full. Negative tests pin the direct path's refusals.

**Measuring.** `bench/yaml-json/run.mjs` gains a `direct` workload beside
`parse` and `load`; same fixture, interleaved rounds, the binary built twice
for the noise band. The PR's `Measured:` trailer states the medians and band.

**Docs and security.** A new public `std/` declaration is a user-visible
change: guide page, `std/README.md` row, regenerated reference. The direct path
is attacker-facing (it reads a peer's YAML), so `docs/security/yaml.md`'s scope
names the new functions and records how expansion, merges, depth and bytes are
bounded on it, each with its test.
