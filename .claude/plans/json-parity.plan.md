---
name: JSON parity — measure against serde_json, simdjson, yyjson, RapidJSON and Go, then close the gap
overview: The JSON stack (nish/json, nish/json-tokenizer, nish/json-typed; #574) is strict and safe, but it has never been timed against another language. Its typed layer also lacks features the major libraries have. First a same-machine comparison benchmark and a wider conformance corpus. Then the measured hot spots (string building, byte-at-a-time scanning, key dispatch) and the missing features (a dynamic JsonValue, lossless numbers, more field kinds, pretty-printing, a strict non-finite mode). Eight stages, eight PRs.
stages:
  - id: bench
    title: bench(std) — JSON against serde_json, simdjson, yyjson, RapidJSON and Go on the same machine
    goal: One opt-in command builds Nish and five comparators. It runs tokenize, typed-decode and serialize workloads over twitter.json, citm_catalog.json and canada.json in interleaved rounds with a noise band, checks every checksum agrees, and records the baseline table in docs/BENCHMARKS.md
    verification: node bench/json-compare/run.mjs --rounds 3 && npm run check && npm run lint && npm run lint:dead && npm test
    todos:
      - id: bench-fetch
        content: Write the fetch script. It pins the corpora and the C/C++ comparator sources by URL and sha256 into an ignored cache, and vendors nothing — see Bench
      - id: bench-comparators
        content: Add the comparator programs (Rust serde_json with a Cargo.lock, C++ simdjson ondemand, C yyjson, C++ RapidJSON, Go encoding/json) for each workload — see Bench workloads
      - id: bench-nish
        content: Add the Nish programs for the same workloads on nish/json-tokenizer, nish/json-typed and nish/json — see Bench workloads
      - id: bench-runner
        content: Add the runner. It interleaves rounds, times a byte-identical copy of the Nish program for the noise band, checks checksums, and prints MB/s and ns per document — see Measurement
      - id: bench-record
        content: Record the baseline table and the exact command in docs/BENCHMARKS.md under a new JSON section — see Bench
      - id: bench-smoke
        content: Add a network-free tests/run.js check that the Nish bench programs compile and give their expected checksum on a small committed sample — see Tests
  - id: conformance
    title: test(std) — test262- and V8-derived JSON conformance, and the JSONTestSuite round trip through the writer
    goal: Every applicable JSON.parse and JSON.stringify case from test262 and V8, kept as data with its BSD notice, passes or is a recorded divergence. Every JSONTestSuite y_ file tokenized and rewritten is JSON.stringify(JSON.parse(x)). This stage also closes the two acceptance gaps from json-complete
    verification: node tests/run.js std_json_conformance && node tests/run.js third-party-licence && bash docs/cookbook/regen.sh --check && npm run check && npm run lint && npm test
    todos:
      - id: conf-extract
        content: Extract test262 built-ins/JSON and V8 mjsunit json cases into data files. Drop the JS-object-model cases (reviver, replacer, toJSON, Proxy, getters), and record the source and licence of each — see Conformance corpus
      - id: conf-run
        content: Add tests/link/std_json_conformance. It runs every case through the tokenizer and writer, and lists each divergence by name with its reason — see Conformance corpus
      - id: conf-roundtrip
        content: Rewrite every JSONTestSuite y_ file through tokenizer and writer and hold it to JSON.stringify(JSON.parse(x)) under Node, natively pinned for non-ASCII — see Conformance corpus
      - id: conf-gaps
        content: Name JSON_TOK_ERR_TOTAL_LIMIT in the tokenizer section of docs/security/json.md, and add cookbook markers so json-tokenizer and json-writer render in docs/IR_COOKBOOK.md — see Acceptance gaps
  - id: writer-modes
    title: feat(std) — pretty-printed output and a strict non-finite mode for JsonWriter
    goal: JsonWriter can indent by N spaces or a tab, with output byte-identical to JSON.stringify(v, null, indent). In strict mode NaN and ±Infinity are a documented sticky error that writes nothing
    verification: node tests/run.js std_json_writer && npm run check && npm run lint && npm run lint:dead && npm test
    todos:
      - id: wm-pretty
        content: Add indentation to JsonWriter with no per-call allocation. It must match JSON.stringify's empty-container and nesting rules — see Writer modes
      - id: wm-strict
        content: Add a strict mode in which f64 NaN and ±Infinity fail with a new JSON_WRITE_NON_FINITE code — see Writer modes
      - id: wm-tests
        content: Hold pretty output to JSON.stringify(v, null, 2 / 4 / "\t") under Node and natively. Pin strict mode and the unchanged default, and keep Arena.used() flat — see Tests
      - id: wm-docs
        content: Update the std/json.ts header, the guide's nish/json section and the cookbook — see Docs
  - id: fast-strings
    title: feat(codegen) — a builtin that makes a string from a byte range in one allocation
    goal: A new builtin builds a string from u8[] bytes in one allocation, natively and under Node. nish/json-typed's string reader uses it in place of one allocation per byte
    verification: node tests/run.js std_json_typed && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint && npm run lint:dead && npm test
    todos:
      - id: fs-builtin
        content: Add the builtin in src/ with the Node prelude shim, a golden .ll, an llvm-as pass, a native round trip and negative tests. src/ itself must not use it (the rolling freeze) — see Fast strings
      - id: fs-runtime
        content: Implement it in the runtime and the wasm32 build. Bounds are checked once, and the result is not validated as UTF-8, matching String.fromCharCode's contract — see Fast strings
      - id: fs-typed
        content: Switch JsonDecoder.string() and its array reader to the builtin, and measure the decode before and after with the noise band — see Measurement
      - id: fs-docs
        content: Add the LANGUAGE.md rule, the cookbook entry and the AI.md line, then regenerate the goldens — see Docs
  - id: tokenizer-scan
    title: perf(std) — scan JSON string bodies, whitespace and numbers in bulk
    goal: JsonTokenizer reads runs of plain bytes without a bounds-checked call per byte, and builds slow-path number text with the fast-strings builtin. Its throughput on the json-compare corpora rises measurably outside the noise band, with every verdict unchanged
    verification: node tests/run.js std_json_tokenizer && node tests/run.js performance && npm run check && npm run lint && npm run lint:dead && npm test
    todos:
      - id: ts-scan
        content: Rewrite the string-body, whitespace and digit loops to check the window once per run, with no new NL9007 — see Tokenizer scanning
      - id: ts-number
        content: Build numberSlow's text with the fast-strings builtin, and add numberU64 for the typed u64 field — see Tokenizer scanning
      - id: ts-proof
        content: Keep the JSONTestSuite verdicts, the fuzz checksum, the mutation-pinned boundaries and the Node run all unchanged — see Tests
      - id: ts-measure
        content: Measure on bench/json-tokenizer and on bench/json-compare against the bench stage's baseline, with the noise band — see Measurement
  - id: json-value
    title: feat(std) — JsonValue, a dynamic JSON tree with lossless numbers, in nish/json-value
    goal: Any JSON document parses into a JsonValue tree that can be read, built and written back. Numbers keep their source text, so integers wider than i64 and f64 survive a round trip. Every limit and error comes from the tokenizer
    verification: node tests/run.js std_json_value && node tests/run.js performance && npm run check && npm run lint && npm run lint:dead && npm test
    todos:
      - id: jv-module
        content: Add std/json-value.ts with JsonValue's kinds, parse, accessors, builders and write, and register it in src/std-modules.ts and release.yml's presence gates — see JsonValue
      - id: jv-numbers
        content: Keep each number's source text, and read it as i64, u64, f64 or text on demand — see JsonValue
      - id: jv-tests
        content: Round-trip every JSONTestSuite y_ file. Refuse every n_ file. Duplicate keys follow a documented policy. Arena reuse across documents. Run under Node — see Tests
      - id: jv-docs
        content: Add the guide section, the std/README row, a security record row and the cookbook entry — see Docs
  - id: typed-kinds
    title: feat(codegen) — u64, enum and Map fields, and key dispatch by length, in typed JSON
    goal: jsonDecode and jsonEncode accept u64, enum and Map<string, T> fields. Keys dispatch by length before comparing bytes, so decoding a class with many fields is faster outside the noise band
    verification: node tests/run.js std_json_typed && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint && npm run lint:dead && npm test
    todos:
      - id: tk-kinds
        content: Add u64, numeric and string enum, and Map<string, T> field kinds to src/json-typed.ts and src/emit-json.ts, with refusals for every shape still excluded — see Typed kinds
      - id: tk-dispatch
        content: Replace the keyIs chain with dispatch by key length, then bytes — see Typed kinds
      - id: tk-tests
        content: Round-trip each kind against JSON.stringify(JSON.parse(x)). Each refused shape gets its own negative case per CLAUDE.md. Measure a many-field class — see Tests
      - id: tk-docs
        content: Update LANGUAGE.md's typed JSON rules, the cookbook, AI.md and the security record — see Docs
  - id: typed-options
    title: feat(codegen) — renamed and optional-with-default fields, and lossless number fields, in typed JSON
    goal: A class can give a field a different JSON name, and can mark a field optional so a missing key keeps its initializer. A JsonNumber field round-trips a number's source text exactly
    verification: node tests/run.js std_json_typed && node tests/run.js wasi && node tests/run.js performance && npm run check && npm run lint && npm run lint:dead && npm test
    todos:
      - id: to-meta
        content: Read per-class field metadata in the form the owner chose at sign-off, and check it at compile time, including unknown field names and duplicate wire names — see Typed options
      - id: to-optional
        content: Make a missing optional key keep the field's initializer, while every other missing key is still refused — see Typed options
      - id: to-number
        content: Add a JsonNumber field kind backed by json-value's lossless number — see Typed options
      - id: to-tests
        content: Round-trip, negative cases for every misuse of the metadata, and the Node run — see Tests
      - id: to-docs
        content: Update LANGUAGE.md, the guide, the cookbook, AI.md and the security record — see Docs
---

# JSON parity

Run bounds: deadline 16 hours from the ledger's opening; up to 4 concurrent workers; up to 10 review rounds per PR. A performance stage merges on any gain outside its noise band, and the report states the remaining gap to each comparator.

Ledger: the `Feature: json-parity` issue. Follows json-complete (#574), whose run report compared Nish's JSON against other languages from published figures. That comparison was approximate and has to be measured, which is this run's first stage.

## Stages, ownership and order

| Stage | Owns | Model | Develops after | Merges after |
|---|---|---|---|---|
| bench | `bench/json-compare/**`, `.gitignore` (cache line) | — | — | — |
| conformance | `tests/json-conformance/**`, `tests/link/std_json_conformance/**`, `THIRD_PARTY_NOTICES.md` | — | — | bench |
| writer-modes | `std/json.ts`, `tests/link/std_json_writer/**`, `bench/json-writer/**` | — | — | conformance |
| fast-strings | `src/builtins.ts`, `src/emit-builtins.ts`, `src/emit-strings.ts`, `src/emit-util.ts`, `src/capabilities.ts`, `src/escape.ts`, `src/strings.ts`, `runtime/**`, `std/json-typed.ts`, `tests/cases/*from_bytes*`, `tests/link/std_json_typed/**` | — | — | writer-modes |
| tokenizer-scan | `std/json-tokenizer.ts`, `tests/link/std_json_tokenizer/**`, `bench/json-tokenizer/**` | — | fast-strings merged | fast-strings |
| json-value | `std/json-value.ts`, `tests/link/std_json_value/**`, `src/std-modules.ts`, `.github/workflows/release.yml` | — | fast-strings merged | tokenizer-scan |
| typed-kinds | `src/json-typed.ts`, `src/emit-json.ts`, `std/json-typed.ts`, `tests/link/std_json_typed/**`, `tests/cases/json_*` | — | tokenizer-scan merged | json-value |
| typed-options | the same files as typed-kinds | — | typed-kinds merged | typed-kinds |

Up to four stages are developed at once: bench, conformance, writer-modes and fast-strings in the first wave.

**Shared files, edited in merge order.** These files are touched by more than one stage, and each stage edits only its own section of them:
- `tests/run.js`;
- `docs/guide/using-nish/standard-library.md`, `docs/LANGUAGE.md`, `docs/AI.md`;
- `docs/IR_COOKBOOK.md` and `docs/cookbook/*`;
- `docs/security/json.md`, `docs/security/README.md`;
- `std/README.md`, `docs/BENCHMARKS.md`;
- the generated goldens (`tests/self/goldens/*`, `tests/differential/*`).

Disjoint ownership cannot cover them, so the merge-order column is a chain. Before its PR merges, each stage merges `main` and regenerates the goldens with the repo's tools, per CLAUDE.md. A conflict in one of these files goes back to that stage's worker.

## Bench

`bench/json-compare/` holds:
- a fetch script;
- one program per comparator per workload;
- the Nish programs;
- `run.mjs`, the runner.

The corpora are nativejson-benchmark's `twitter.json`, `citm_catalog.json` and `canada.json`. The comparator sources are a simdjson single-header release, yyjson, and RapidJSON's headers. All of them are fetched by URL and sha256 into a git-ignored cache, and none is vendored.

- RapidJSON's `bin/jsonchecker` files carry the JSON licence ("Good, not Evil"), which `.claude/licensing.md` does not allow. They are never fetched.
- serde_json is built with cargo against a committed `Cargo.lock`.
- Go uses the standard library.

The bench needs a network and toolchains, so it never runs in `npm test`. A network-free smoke check in `tests/run.js` covers the Nish side only.

### Bench workloads

1. **Tokenize.** Visit every token and fold strings and numbers into a checksum. Comparators:
   - simdjson ondemand;
   - yyjson read and walk;
   - RapidJSON's Reader (SAX);
   - serde_json `IgnoredAny` or a visitor;
   - Go's `json.Decoder.Token`.
2. **Typed decode** of `citm_catalog.json`'s `performances` array into declared classes. Comparators:
   - serde derive;
   - Go structs;
   - simdjson ondemand into structs.

   yyjson and RapidJSON are skipped here, because they have no typed layer.
3. **Serialize.** Write the typed values back out, minified. Every comparator's output is held to the same bytes.

## Measurement

The rules are CLAUDE.md's:
- each loop's input changes every iteration;
- each output is folded into a printed checksum;
- rounds are interleaved;
- the Nish program is timed against a byte-identical copy of itself to give the noise band;
- a figure is claimed only when it falls outside that band.

`Measured:` trailers are copied from the head being merged. Performance stages report against the bench stage's baseline.

## Conformance corpus

- **test262** `test/built-ins/JSON/{parse,stringify}` (BSD-3, Ecma International). Keep cases whose input and expected output are JSON text or a primitive. Drop reviver, replacer, toJSON, space-as-object, Proxy, getter and BigInt-TypeError cases.
- **V8** `test/mjsunit/json*.js` (BSD-3), with the same filter.

Each case is a data row of source, input, and expected value or error. The `THIRD_PARTY_NOTICES.md` rows and the licence texts follow `.claude/licensing.md`. A case Nish deliberately answers differently is listed by name with its reason, and is never silently skipped. Examples: lone surrogates are refused, and i64 is exact.

## Acceptance gaps

Two gaps were found by json-complete's acceptance check:
- `JSON_TOK_ERR_TOTAL_LIMIT` is not named in `docs/security/json.md`'s tokenizer section.
- `docs/cookbook/json-tokenizer.ts` and `json-writer.ts` have no `cookbook:begin` markers, so they do not render in `docs/IR_COOKBOOK.md`.

## Writer modes

- **Indent:** spaces from 1 to 10, or a tab. These are `JSON.stringify`'s rules: an empty `{}` or `[]` stays on one line, and `key: value` has one space after the colon.
- **Strict mode:** off by default, so existing behaviour does not change.
- **No allocation per call:** the indent is written from a constant.

## Fast strings

The name and signature are the stage's to propose, and the reviewer checks them against LANGUAGE.md's builtin conventions. It is presumably shaped like `String.fromBytes(bytes, start, end)`.

- One allocation and one copy.
- The bounds are checked once, and an out-of-range argument is a defined panic. This matches the existing array rules.
- The result is not validated as UTF-8, matching `String.fromCharCode`.
- Under Node, the bytes become one code unit each, the same divergence `fromCharCode` already has, recorded under WP33.

## Tokenizer scanning

For example, `stringBody(i)` loops over `src[i]` while `i < end` with the end proven once, instead of calling `jsonTokByteAt` per byte. The window-guard, UTF-8 table and surrogate rules are unchanged, and the mutation-pinned boundaries from #582 must still fail their mutants.

## JsonValue

- **Kinds:** null, boolean, number (raw text plus parsed forms), string, array, object.
- **Objects** keep insertion order. Duplicate keys follow a documented policy, proposed by the stage and checked against docs/security JSON-3.
- **Parse** reuses an arena-backed pool across documents.
- **Write** goes through JsonWriter, including pretty mode once writer-modes has merged.

## Typed kinds

- **u64** reads through the tokenizer's `numberU64`.
- **Enums:**
  - a numeric enum is written as its number;
  - a string enum as its string;
  - an unknown value is `JSON_DECODE_TYPE`.
- **Map<string, T>** fields take any eligible T.
- **Key dispatch:** switch on key length, then compare bytes, generated per class.

## Typed options

Decorators are forbidden in Nish. The owner chose the form at sign-off: a class declares its JSON options in one `static readonly json` object literal, for example `static readonly json = { rename: { userId: "user_id" }, optional: ["tags"] }`. The compiler reads it when it writes the per-class code, so a misspelt field, a duplicate wire name or a non-literal value is a compile error with its own NL code and negative case.

- **Optional fields:** a missing key keeps the field's initializer. Every other missing key is still refused.
- **JsonNumber** keeps a number's source text losslessly.

## Tests

Every construct ships what CLAUDE.md's definition of done asks:
- a golden `.ll`;
- an `llvm-as` pass;
- a native round trip with expected stdout;
- negative tests;
- a LANGUAGE.md rule and a cookbook entry;
- a Node run wherever the module is meant to run under Node.

Every new public reader runs once under Node. Every refused shape has its own negative case.

## Docs

Each stage updates its own sections of the guide (#585 rule), LANGUAGE.md, AI.md, std/README.md, the security record and the cookbook. `docs/BENCHMARKS.md` gets a JSON section from the bench stage, and the performance stages update their rows.
