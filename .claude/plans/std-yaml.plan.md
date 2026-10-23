---
name: nish/yaml — a lint-grade YAML parser in std, faster than mjst's
overview: Add a YAML 1.2 parser to the standard library on the model of mjst's @amritk/yaml — every node and diagnostic carries a byte range that converts to line and column, paths resolve to nodes and keys through aliases and merge keys — held to the yaml-test-suite and benchmarked against @amritk/yaml until it is at least 2x faster on every fixture, with its scans on the SIMD indexOfAny kernel.
stages:
  - id: yaml-suite
    title: Vendor the yaml-test-suite as packed test data
    goal: Put the yaml-test-suite's cases (input, expected JSON stream, error flag) into tests/yaml-suite/ in a packed text form a Nish program and Node can both read, with its MIT notice recorded
    verification: node tests/yaml-suite/pack.js --check exits 0; npm run lint; node tests/run.js third-party passes
    status: pending
    todos:
      - id: suite-pack
        content: Write tests/yaml-suite/pack.js that fetches the suite at a pinned data-release tag, checks its sha256 and writes tests/yaml-suite/cases.txt — see Stage 1, The packed form
        status: pending
      - id: suite-licence
        content: Add tests/yaml-suite/LICENSE-yaml-test-suite and the notice block and Files-table row in THIRD_PARTY_NOTICES.md — see Stage 1, Licence
        status: pending
      - id: suite-readme
        content: Write tests/yaml-suite/README.md naming the pin, the format and how to repack — see Stage 1, The packed form
        status: pending
  - id: yaml-parser
    title: std/yaml — the parser, the node model, diagnostics, lines and paths
    goal: Ship nish/yaml, which parses a YAML stream into a struct-of-arrays tree with byte ranges on every node, pair and diagnostic, converts an offset to 1-based line and column, resolves a path to a node or a pair, and renders a key as text
    verification: npm run check; npm run lint; node tests/run.js std_yaml; node tests/run.js performance; node tests/run.js wasi; an undegraded npm test before the PR
    status: pending
    todos:
      - id: parser-model
        content: Define YamlStream's struct-of-arrays node store, node kinds, styles, scalar types and handles in std/yaml.ts — see Stage 2, The node model
        status: pending
      - id: parser-scan
        content: Implement the block and flow parser in std/yaml.ts and std/yaml-*.ts (all scalar styles, block scalars, multi-document streams, directives, anchors, aliases, tags, explicit keys) with every scan of a run of bytes on indexOfAny — see Stage 2, Parsing and Stage 2, Performance from the start
        status: pending
      - id: parser-resolve
        content: Resolve plain scalars to the core schema (null, bool, int, float, string) lazily, on first read — see Stage 2, Scalars
        status: pending
      - id: parser-diagnostics
        content: Report every problem as a code, a kind, a message and a byte range, with the 29 codes named as mjst names them — see Stage 2, Diagnostics
        status: pending
      - id: parser-lines
        content: Add YamlLineIndex (offset to 1-based line, character column and byte column, CRLF and lone CR as one break) — see Stage 2, Lines
        status: pending
      - id: parser-paths
        content: Add yamlKeyText, pathNode and pathPair with closest-ancestor fallback and alias following — see Stage 2, Paths
        status: pending
      - id: parser-register
        content: Add the new modules to stdModuleNames in src/std-modules.ts and regenerate tests/self/goldens with node tests/self/goldens.js --update — see Stage 2, Registration
        status: pending
      - id: parser-tests
        content: Add tests/link/std_yaml/ (units per feature, one negative per diagnostic code, a lint-style line and column printout) and one link case per panic — see Tests
        status: pending
      - id: parser-docs
        content: Add the nish/yaml row to std/README.md and a nish/yaml section with compiled examples to docs/guide/using-nish/standard-library.md — see Stage 2, Docs
        status: pending
  - id: yaml-conformance
    title: Merge-aware paths, and the yaml-test-suite run
    goal: Make pathNode and pathPair follow merge keys, and hold the parser to the vendored yaml-test-suite at mjst's pass count or better
    verification: npm run check; npm run lint; node tests/run.js std_yaml; node tests/run.js std_yaml_conformance; node tests/run.js performance; an undegraded npm test before the PR
    status: pending
    todos:
      - id: merge-paths
        content: Make pathNode and pathPair follow merge keys in std/yaml*.ts when options.merge is on (a map or a list of maps, explicit keys win, recursion bounded) — see Stage 3, Merge-aware paths
        status: pending
      - id: conformance-run
        content: Add tests/link/std_yaml_conformance/ with a tree-versus-JSON comparer, the pinned pass count and an expected-failure list that fails on stale or unknown ids — see Stage 3, Conformance
        status: pending
      - id: conformance-fixes
        content: Fix the parser bugs the conformance run finds in std/yaml*.ts until the pass count is at least mjst's 397 of 402 — see Stage 3, Conformance
        status: pending
      - id: conformance-docs
        content: Document merge-aware paths in the nish/yaml guide section — see Stage 3, Docs
        status: pending
  - id: yaml-perf
    title: Benchmark against @amritk/yaml and make nish/yaml faster
    goal: Measure nish/yaml against mjst's @amritk/yaml on the same fixtures and tune the parser until it is at least 2x faster at the median on every fixture and both workloads, with the figures recorded
    verification: node bench/yaml-compare/run.mjs prints every fixture with both implementations and a checksum match; node tests/run.js yaml-compare; node tests/run.js std_yaml; node tests/run.js std_yaml_conformance; node tests/run.js performance; an undegraded npm test before the PR
    status: pending
    todos:
      - id: perf-harness
        content: Write bench/yaml-compare/ (fetch.mjs pinning fixtures and @amritk/yaml, main.ts, run.mjs with interleaved rounds, min and median, a checksum per run) on bench/json-compare's pattern — see Stage 4, The harness
        status: pending
      - id: perf-check
        content: Add the yaml-compare check to tests/run.js that builds main.ts and holds it to sample.expected without the network — see Stage 4, The harness
        status: pending
      - id: perf-baseline
        content: Record the baseline table in bench/README.md before any tuning — see Stage 4, Measuring
        status: pending
      - id: perf-tune
        content: Profile and tune std/yaml*.ts (perf record, the hot scans onto indexOfAny, no per-node allocation, no substring until a scalar is read, presized stores) and re-measure after each change — see Stage 4, Techniques
        status: pending
      - id: perf-record
        content: Record the final table with its noise band in bench/README.md and docs/BENCHMARKS.md between yaml-compare markers — see Stage 4, Measuring
        status: pending
---

## Context

mjst's lint reads YAML through `@amritk/yaml` (`mjst/packages/yaml`, about 5,200 lines of TypeScript, 397 of 402 yaml-test-suite cases). What lint needs from it is narrow: `parseAllDocuments`, the node tree with `start`/`end` offsets on every node and pair, the diagnostics (`code`, `message`, `start`, `end`), `keyText`, alias targets, a path-to-node lookup it reimplements with merge keys, an offset-to-line map, and `toJS()` for the value. Nish has no YAML reader. Its JSON modules ([std/json-value.ts](../../std/json-value.ts), [std/json-tokenizer.ts](../../std/json-tokenizer.ts)) show the house style: struct-of-arrays stores, `i32` handles, sticky integer error codes, byte offsets only.

This plan ports the *contract* of `@amritk/yaml`, not its code: the same features, the same diagnostic code names, the same path semantics, so a Nish linter can report the same `line:col code` a mjst lint run does. And it is to be faster than `@amritk/yaml`, measured.

## Approach

- **A struct-of-arrays tree, not objects.** Nish has no `unknown` and no class hierarchy; `JsonDocument` already proves the SoA-plus-handle shape is the fast one here. Every node is an `i32` handle into parallel arrays (`kind`, `start`, `end`, `first`, `count`, `tag`, `anchor`, `style`, `target`). No allocation per node.
- **Byte offsets everywhere; line and column on demand.** A Nish string is UTF-8 and `length` is bytes, so ranges are byte offsets. `YamlLineIndex` turns one into a 1-based line, a character (code point) column and a byte column. It is built lazily — a clean parse never pays for it.
- **Values are lazy.** A scalar records its range and style. Decoding (escapes, folding, block chomping) and core-schema resolution happen when it is first read, so lint passes that look at three keys of a 10 MB spec do not decode the rest.
- **SIMD where Nish has it.** There is no vector type in the language; the one vector path std may use is `indexOfAny` in [std/text.ts](../../std/text.ts), which the compiler lowers to the AVX2/SSE2 kernel `nish_str_index_of_any` ([src/kernels.ts](../../src/kernels.ts), WP38 S1). Its set holds up to 16 ASCII bytes — enough for every YAML run scan: plain scalar ends, quoted scalar ends, comment ends, flow indicators. Line starts use `indexOf` (glibc's vectorised `memchr`). A new runtime kernel is out of scope (see Out of scope).
- **No toJS equivalent.** A linter walks the tree, which carries positions; a value projection would drop them. Scalars already resolve to typed values on the tree. What mjst's lint gets from `toJS()` that it needs — merge keys — moves into path lookup instead, so a path through `<<: *defaults` lands on the merged key with its range (mjst's lint reimplements that in `yaml-merge-key.ts` because `nodeAtPath` does not do it).
- **Names are prefixed.** std shares one flat namespace (std/README.md, "Writing a module here"); every exported and private name starts with `yaml`, `Yaml` or `YAML_`.

## Stage 1 — Vendor the yaml-test-suite

**Owns:** `tests/yaml-suite/**`, `THIRD_PARTY_NOTICES.md`
**Model:** sonnet

### The packed form

On [tests/json-suite/](../../tests/json-suite/)'s pattern: kebab-case file names are enforced and the inputs hold tabs, CRs, NULs and invalid UTF-8, so the cases are packed rather than copied. `pack.js` fetches the yaml-test-suite **data release** at a pinned tag (`data-2022-01-17` or the latest data tag; record which) by URL and sha256, and writes `tests/yaml-suite/cases.txt`: one case per record, keyed `ID` or `ID/n` for multi-case files exactly as mjst's `conformance.test.ts` keys them, with fields `in.yaml`, `in.json` (absent when the suite has none), and the `error` flag. Bytes outside printable ASCII and `%` are `%XX`-escaped, as `tests/json-suite/test-parsing.txt` does. `pack.js --check` refetches nothing: it re-derives the file from the cache when present, else verifies the header pin, record count and per-record well-formedness, and exits non-zero on any mismatch. The header carries the notice text the third-party-licence check compares.

Record in `README.md`: the pin, the record count, the format, the command to repack.

### Licence

The yaml-test-suite is MIT. Add `LICENSE-yaml-test-suite` with the upstream text, and in `THIRD_PARTY_NOTICES.md` a `### tests/yaml-suite/LICENSE-yaml-test-suite` entry with its fenced notice block and a Files-table row, mirroring the JSONTestSuite entry. Check `.claude/licensing.md` first.

## Stage 2 — std/yaml

**Owns:** `std/yaml.ts`, `std/yaml-*.ts`, `tests/link/std_yaml/**`, `tests/link/std_yaml_*/**` except `tests/link/std_yaml_conformance/**`, `src/std-modules.ts`, `tests/self/goldens/checked/**` (generated), `std/README.md`, `docs/guide/using-nish/standard-library.md`

Split the parser across files as it reads best (for example `std/yaml.ts` for the public surface and store, `std/yaml-scan.ts` for the scanner, `std/yaml-lines.ts` for the line index); each file is a module and each needs its `stdModuleNames` entry.

### The node model

```ts
export type YamlNode = i32 // handle; YAML_NONE (-1) for absent
export const YAML_SCALAR: i32 = 1; YAML_MAP = 2; YAML_SEQ = 3; YAML_ALIAS = 4; YAML_PAIR = 5
export const YAML_STYLE_PLAIN = 0; _SINGLE; _DOUBLE; _LITERAL; _FOLDED; _FLOW; _BLOCK
export const YAML_TYPE_STRING = 0; _NULL; _BOOL; _INT; _FLOAT

export class YamlOptions { uniqueKeys: boolean; merge: boolean; keepComments: boolean; maxDepth: i32; maxAliasNodes: i32 }
export const yamlDefaultOptions = (): YamlOptions => …   // true, true, false, 1000, 20_000_000

export class YamlStream {
  constructor(options: YamlOptions)
  parse(text: string): i32                 // number of documents; resets the store
  documentCount(): i32
  root(doc: i32): YamlNode                 // YAML_NONE for an empty document
  documentStart(doc: i32): i32; documentEnd(doc: i32): i32
  kind(n): i32; start(n): i32; end(n): i32 // [start, end) byte range
  length(n): i32                           // items of a map (pairs) or seq
  item(n, i): YamlNode                     // a seq's node or a map's pair
  key(pair): YamlNode; value(pair): YamlNode   // value YAML_NONE for `key:` with nothing
  style(n): i32; tag(n): string; anchor(n): string; hasTag(n): boolean; hasAnchor(n): boolean
  aliasName(n): string; aliasTarget(n): YamlNode   // the anchor in scope at the alias; YAML_NONE if unresolved
  source(n): string                        // raw text of the range
  scalarType(n): i32; text(n): string      // decoded value; resolved lazily
  bool(n): boolean; i64(n): i64; f64(n): f64
  // diagnostics, per document, in source order
  errorCount(doc): i32; warningCount(doc): i32
  errorCode(doc, i): i32; errorStart(doc, i): i32; errorEnd(doc, i): i32; errorMessage(doc, i): string
  warningCode(…); warningStart(…); warningEnd(…); warningMessage(…)
  commentCount(doc): i32; commentStart(doc, i): i32; commentEnd(doc, i): i32   // only with keepComments
}
```

Exact signatures are the worker's call within this shape; the semantics are mjst's (`mjst/packages/yaml/src/types.ts`): tags stored resolved (`!!str` and `!<tag:yaml.org,2002:str>` both read `str`, a local tag keeps its `!`, `%TAG` handles expanded), anchors without `&`, a property written on a key describes the key, document markers and directives are framing only.

### Parsing

Everything `@amritk/yaml`'s README lists as supported (mjst `packages/yaml/README.md`): block and flow maps and seqs (multi-line flow, trailing commas, `[k: v]` single pairs, `? key` / `: value` with complex keys), empty nodes, plain multi-line folded scalars, single- and double-quoted scalars with every escape (`\x`, `\u`, `\U`; an invalid escape keeps its backslash and reports `BAD_ESCAPE`), `|` and `>` with chomping and explicit indentation, `---`/`...` streams with a root on the `---` line, a BOM, LF/CRLF/CR, anchors and aliases (redefinition binds to the anchor in scope), tags including verbatim and `%TAG`, `%YAML`/`%TAG` directives. Limits: `maxDepth` (`DEPTH_LIMIT`), implicit keys of 1024 bytes in block context. Tab indentation is an error, as in mjst. Problems are collected, never panicked: a malformed document yields a tree as far as it parsed plus diagnostics. `panic` is only for a caller's misuse (a bad handle).

### Performance from the start

This stage is measured in Stage 4, so build it to be fast now:

- The source is read with `charCodeAt` on one string; never `substring` while parsing. A node is a range.
- Every scan of a run uses `indexOfAny` from `nish/text` (plain scalar ends in block context `":#\n\r"` plus flow indicators in flow context; double-quoted `"\"\\\n\r"`; single-quoted `"'\n\r"`; comment ends `"\n\r"`), so each lands on the kernel. Check with `build/nish --emit-llvm` or the IR that the calls lower to `nish_str_index_of_any`.
- Stores are presized from the text length (a heuristic such as `length / 8` nodes) and grow by doubling.
- No `Map` in the hot path. Anchors are few; a small array scanned backwards is the right shape (scope = last definition before the alias).
- Duplicate-key detection (`uniqueKeys`) must stay linear-ish: compare keys by byte range first (length and first byte), decode only on collision; switch to a hash once a map passes 16 pairs.
- Every array index proven, so the std performance gate (NL9xxx warnings fail `tests/run.js`) passes under `--number-mode i32` and `f64`.

### Scalars

Core schema, as `mjst/packages/yaml/src/resolve-scalar.ts`: null (`null`/`Null`/`NULL`/`~`/empty), bool (`true`/`True`/`TRUE`/`false`/…), int (decimal, `0x`, `0o`, optional sign), float (decimal, exponent, `.inf`, `-.inf`, `.nan` in their case variants), everything else a string; `1.0.0` and dates stay strings; only plain scalars resolve, quoted ones are strings. A core tag (`!!str`, `!!int`, `!!float`, `!!bool`, `!!null`) forces the type; a value that does not fit warns `BAD_TAG_VALUE` and stays a string. `text(n)` returns the decoded string for any scalar; `i64`/`f64`/`bool` panic on a scalar of another type (the caller checks `scalarType` first).

### Diagnostics

Codes are `i32` constants (`YAML_ERR_UNEXPECTED_CONTENT` …) with `yamlErrorName(code): string` returning mjst's exact spelling (`UNEXPECTED_CONTENT`, `TAB_INDENT`, `DUPLICATE_KEY`, …), all 29 from `mjst/packages/yaml/src/types.ts:111-140`, with the same error/warning split (`BAD_DIRECTIVE` and `DUPLICATE_DIRECTIVE` error for `%YAML`, warning for `%TAG`). Messages are one sentence, lower-case start, no trailing period, as mjst's. Ranges point at the offending bytes, not the document.

### Lines

```ts
export class YamlLineIndex {
  constructor(text: string)       // one pass with indexOf over "\n" and "\r"
  line(offset: i32): i32          // 1-based
  column(offset: i32): i32        // 1-based, in code points
  byteColumn(offset: i32): i32    // 1-based, in bytes
  lineStart(line: i32): i32; lineCount(): i32
}
```

CRLF is one break, a lone CR is a break (YAML 1.2 §5.4); offsets clamp to `[0, length]`; lookup is a binary search.

### Paths

- `yamlKeyText(s: YamlStream, key: YamlNode): string` — mjst's `keyText`: a scalar's decoded text, a collection key rendered in flow form (`[ a, b ]`), an empty key `""`, bounded work.
- `pathNode(root, segments: string[], closest: boolean): YamlNode` on `YamlStream` — mjst's `nodeAtPath`: a map segment matches `yamlKeyText` of a key (last duplicate wins), a seq segment must be a canonical non-negative integer, aliases mid-path are followed through their target (at most 100 hops), a path ending on an alias returns the alias, `closest` returns the deepest existing ancestor.
- `pathPair(root, segments: string[]): YamlNode` — the pair holding the last segment, so a linter can point at the **key** (`key(pair)`'s range) rather than the value. Merge keys are not followed yet; Stage 3 adds them.

### Registration

Add each new module (`yaml`, and any `yaml-*` file) to the literal in `stdModuleNames` in [src/std-modules.ts](../../src/std-modules.ts), sorted; `tests/run.js` fails otherwise. This is a `src/` change: run `node tests/run.js wasi` (with `WASI_SYSROOT=/usr`) and `node tests/run.js performance`, and regenerate `tests/self/goldens/checked/` with `node tests/self/goldens.js --update`, reading the diff.

### Docs

A row in [std/README.md](../../std/README.md)'s module table, and a `## \`nish/yaml\`` section plus table row in [docs/guide/using-nish/standard-library.md](../../docs/guide/using-nish/standard-library.md) with `ts nish:ok` examples: parse a stream, walk a map, print every diagnostic as `line:col CODE message`, find a key by path. Follow docs/README.md → "Writing a guide page".

## Stage 3 — Merge-aware paths and conformance

**Owns:** `std/yaml.ts`, `std/yaml-*.ts`, `tests/link/std_yaml_conformance/**`, `tests/link/std_yaml/**`, `tests/link/std_yaml_*/**`, `tests/run.js`, `src/std-modules.ts`, `tests/self/goldens/checked/**` (generated), `std/README.md`, `docs/guide/using-nish/standard-library.md`
**Depends on:** yaml-suite and yaml-parser merged (it reads both)

### Merge-aware paths

When `options.merge` is on, `pathNode` and `pathPair` look a map segment up in the map's own keys first, then in the maps its `<<` pairs name, in order: a `<<` whose value is an alias to a map, a map, or a seq of those (YAML merge-key spec; mjst lint's `yaml-merge-key.ts` is the behaviour to match). Explicit keys win over merged ones; among merged maps the first listed wins. Following is bounded (the 100-hop alias limit, and a visited check so a recursive alias terminates). `pathPair` on a merged key returns the pair inside the merged map, so the range points at the key where it is written. With `merge` off, `<<` is an ordinary key. Unit tests in `tests/link/std_yaml/` cover each shape, override order, a recursive alias, and `merge` off.

### Conformance

`tests/link/std_yaml_conformance/` reads `tests/yaml-suite/cases.txt` (decode the `%XX` form in Nish, as `tests/link/std_json_tokenizer/corpus.ts` does for JSONTestSuite) and for each case: an `error` case passes if any document reports an error; otherwise no document may report one, and each document must equal the case's JSON stream. The comparison is a test-local walker, not std API: parse the expected JSON with `JsonDocument` and walk it beside the `YamlStream` — scalars by resolved type against JSON kinds (numbers compared by value), maps against objects by `yamlKeyText` with key order ignored and the last duplicate winning, aliases followed to their target, `<<` merge keys applied, with a node budget so an alias bomb in the suite fails the case rather than hanging the run. `!!binary`, `!!set` and `!!omap` cases are the expected failures mjst also has. The program prints the pass count and fails on a regression, on a pass listed in the expected-failure list (stale), and on an unknown id. The bar is **at least 397 of 402 with `uniqueKeys` on**, mjst's figure; list each remaining failure with a one-line reason. Fix the parser bugs found here in `std/yaml*.ts`. Wire the data path into `tests/run.js` only if the link runner cannot hand the file to the program otherwise (check how `std_json_conformance` reads its data first; it uses `readFileSyncOrNull`).

### Docs

Extend the `nish/yaml` guide section with a compiled example of a path through a merge key, and note in std/README.md's row that paths follow merges.

## Stage 4 — Benchmark and tune

**Owns:** `std/yaml.ts`, `std/yaml-*.ts`, `bench/yaml-compare/**`, `bench/README.md`, `.gitignore`, `docs/BENCHMARKS.md`, `tests/run.js`, `tests/link/std_yaml/**`, `tests/link/std_yaml_conformance/**`, `tests/self/goldens/checked/**` (generated)
**Depends on:** yaml-conformance merged

### The harness

On [bench/json-compare/](../../bench/json-compare/)'s pattern. `fetch.mjs` pins by URL and sha256 into `bench/yaml-compare/cache/` (add it to `.gitignore` beside `bench/json-compare/cache/`): `@amritk/yaml` from the npm registry at a fixed version, and three to five fixtures that span the shapes lint reads — a large OpenAPI document (several MB), a Kubernetes multi-document manifest, a flow-heavy or JSON-as-YAML file, a block-scalar-heavy file (CI configs), and an anchor/merge-heavy file. Licences of fetched fixtures are checked against `.claude/licensing.md`; none is vendored. `main.ts` is a Nish program: `<workload> <file> <iterations>` → parse (and, as a second workload, parse + walk every node + read every scalar's text, which is lint's real cost), printing a checksum (document count, node count per kind, error count — not offsets, which are bytes in Nish and UTF-16 units in JS). The Node side runs `@amritk/yaml`'s `parseAllDocuments` and the same walk over its tree, printing the same checksum; a checksum mismatch is a failed run, not a slower one. `run.mjs` runs interleaved rounds (default 15), reports min and median per fixture and implementation, and the ratio. Nish builds with `--link --profile speed`. Bun is a second JS column if `bun --version` answers. It never runs in `npm test`; a `yaml-compare` check in `tests/run.js` builds `main.ts` and holds it to `sample.expected` on a small committed sample.

### Measuring

Take the baseline table on the parser as Stage 3 left it, before any change, and put it in `bench/README.md`. After tuning, record the final table in both `bench/README.md` and `docs/BENCHMARKS.md` between `yaml-compare` markers, with the commit, the machine, and the noise band per `.claude/testing.md` → "A `Measured:` trailer". The bar: **nish/yaml at least 2x faster than @amritk/yaml under Node at the median on every fixture, on both workloads.** If a fixture misses it after tuning, record why from the profile and open the PR as a draft saying so.

### Techniques

Measure first (`perf record` on the native binary), then in order of what the profile shows:

- Runs onto `indexOfAny` wherever a byte loop remains; confirm the lowering in the IR.
- Indentation and line-start bookkeeping from the scanner's own position, never a re-scan.
- No `substring` and no string building until a scalar is read; key compare by bytes.
- Store arrays presized, growth by doubling, hot fields read once into locals (`toI32(...)` once per function, per std/README.md).
- Branch layout: the common case (block map of plain scalars) first; the dispatch on the first byte of a node a `switch`.
- Duplicate-key check and anchor lookup off the per-pair path unless needed.
- `--profile speed` and `--cpu x86-64-v3` measured as separate columns if the flag exists on `main`; the default build is the figure that counts.

Every tuning change keeps `node tests/run.js std_yaml` and `std_yaml_conformance` green. Behaviour does not change in this stage.

## Out of scope

- A new runtime SIMD kernel, a block classifier (WP38 S1b/S6c) or `nish:simd`: those are compiler and runtime work under `docs/wp38-simd.md`'s bars and the owner's decisions; this plan uses the kernel std already has.
- A value projection (`toJS` / a conversion to `nish/json-value`): linters walk the tree; add one later if a JSON Schema validator over `JsonDocument` needs it.
- YAML emission (a writer), comment attachment to nodes, YAML 1.1 schemas, tab indentation, typed decoding into classes (`jsonDecode`-style generated code).
- A UTF-16 column. Columns are code points and bytes.
- Porting mjst's lint itself.

## Tests

| What | Where |
| --- | --- |
| Units per feature: block/flow collections, every scalar style and chomping mode, multi-docs, directives, anchors/aliases, tags, explicit keys, BOM, CRLF/CR | `tests/link/std_yaml/` (multi-file, on `tests/link/std_json_tokenizer/`'s layout), `Suite` from `nish/testing` |
| One negative per diagnostic code, asserting code, kind and exact byte range | `tests/link/std_yaml/` |
| A lint-style printout: a known-bad file → `line:col CODE message` lines in `expected.out` | `tests/link/std_yaml/` |
| Line index: LF, CRLF, CR, multi-byte UTF-8 columns, clamping | `tests/link/std_yaml/` |
| Paths: map, seq, alias mid-path, duplicate keys, `closest`, `pathPair` key range | `tests/link/std_yaml/` |
| Each `panic` (bad handle, wrong scalar type read) | one `tests/link/std_yaml_<case>/` with `expected.code` and `expected.err` each |
| Merge-aware paths: map, list of maps, override order, recursive alias, `merge` off | `tests/link/std_yaml/` (Stage 3) |
| Conformance | `tests/link/std_yaml_conformance/` (Stage 3) |
| Bench harness builds and matches its sample | `tests/run.js` "yaml-compare" (Stage 4) |

## Verification

```bash
npm run check
npm run lint
node tests/run.js std_yaml                 # link programs for the module
# tests/run.js checks the stdModuleNames list on every run, whatever the section
node tests/run.js performance              # the std performance gate (NL9xxx)
WASI_SYSROOT=/usr node tests/run.js wasi   # src/std-modules.ts is a src/ change
node tests/self/goldens.js --update        # then read the diff
npm test                                   # undegraded: read the skip count
```
