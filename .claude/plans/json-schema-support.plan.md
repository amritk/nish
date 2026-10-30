---
name: What a JSON Schema validator needs from std
overview: Close the gaps a JSON Schema validator or linter written in Nish still has — source ranges on JsonDocument, YAML loaded into the same tree, regex Unicode properties and folding, JSON Pointer, value equality and exact decimal arithmetic, and the format checks — without any existing benchmark getting slower.
stages:
  - id: json-ranges
    title: JsonDocument keeps each value's source range, opt-in
    goal: A parse with ranges on records every value's and every member key's byte range, and with ranges off costs exactly what it costs on main
    verification: npm run check && npm run lint && node tests/run.js std_json && node tests/run.js instructions
    todos:
      - id: ranges-api
        content: Add the opt-in range recording to JsonDocument in std/json-value.ts — see JsonDocument ranges
        status: pending
      - id: ranges-setter
        content: Add the range setters a loader uses to fill ranges on values it builds — see JsonDocument ranges
        status: pending
      - id: ranges-tests
        content: Add tests/link/std_json_value_ranges covering every value kind, keys, nesting, reparse and builders — see Tests
        status: pending
      - id: ranges-bench
        content: Add bench/json-value, JsonDocument.parse over the json-compare corpora, and record main against head — see Performance rule
        status: pending
      - id: ranges-docs
        content: Update std/README.md, the nish/json-value guide section and docs/security/json.md — see JsonDocument ranges
        status: pending
  - id: json-pointer-equality-decimal
    title: JSON Pointer, value equality and exact decimal numbers
    goal: Three new std modules give a validator RFC 6901 pointers, JSON-Schema equality and hashing of values, and exact comparison and multipleOf on number text
    verification: npm run check && npm run lint && node tests/run.js std_json_pointer && node tests/run.js std_json_equal && node tests/run.js std_json_number
    todos:
      - id: pointer-module
        content: Add std/json-pointer.ts with parse, escape, resolve over JsonDocument and the json-pointer and relative-json-pointer syntax checks — see JSON Pointer, equality, decimals
        status: pending
      - id: equal-module
        content: Add std/json-equal.ts with deep equality by JSON Schema rules, a hash that agrees with it, and a first-duplicate finder for uniqueItems — see JSON Pointer, equality, decimals
        status: pending
      - id: number-module
        content: Add std/json-number.ts with exact comparison and multipleOf on JSON number text, bounded on extreme exponents — see JSON Pointer, equality, decimals
        status: pending
      - id: pede-tests
        content: Vendor the JSON-Schema-Test-Suite cases these answer and add a link test per module — see Tests
        status: pending
      - id: pede-docs
        content: Add the three std/README.md rows, guide sections and THIRD_PARTY_NOTICES.md entry — see JSON Pointer, equality, decimals
        status: pending
  - id: json-formats
    title: The JSON Schema format checks
    goal: std/json-format.ts answers valid, invalid or unknown for every draft 2020-12 format it implements, and agrees with JSON-Schema-Test-Suite on all of them
    verification: npm run check && npm run lint && node tests/run.js std_json_format
    todos:
      - id: formats-module
        content: Add std/json-format.ts with the date, time, duration, email, hostname, ip, uuid, uri and regex checks and one dispatcher — see Format checks
        status: pending
      - id: formats-tests
        content: Vendor JSON-Schema-Test-Suite draft2020-12 optional/format and drive every implemented format through it — see Tests
        status: pending
      - id: formats-docs
        content: Add the std/README.md row, the guide section and the THIRD_PARTY_NOTICES.md entry — see Format checks
        status: pending
  - id: yaml-into-json
    title: Load a YAML document into a JsonDocument with its ranges
    goal: One validator and one YamlLineIndex serve JSON and YAML, because a YAML document loads into the same JsonDocument tree with every range pointing at the YAML source
    verification: npm run check && npm run lint && node tests/run.js std_yaml && node tests/run.js std_json_value && node tests/run.js yaml-compare
    todos:
      - id: yaml-json-module
        content: Add std/yaml-json.ts, a YamlStream document into a JsonDocument with value and key ranges filled — see YAML into JsonDocument
        status: pending
      - id: yaml-json-limits
        content: Refuse what JSON cannot hold and bound alias expansion by maxValues, each with a code and a range — see YAML into JsonDocument
        status: pending
      - id: yaml-json-tests
        content: Add tests/link/std_yaml_json including the JSON and YAML twins of one document and an alias bomb — see Tests
        status: pending
      - id: yaml-json-docs
        content: Add the std/README.md row and the guide section, with line and column from one YamlLineIndex over either text — see YAML into JsonDocument
        status: pending
  - id: regex-unicode
    title: Unicode property escapes and folding in nish/regex
    goal: regexCompile accepts the u flag and the property escapes and Unicode case folding JSON Schema patterns use, and patterns without them run exactly as fast as on main
    verification: npm run check && npm run lint && node tests/run.js std_regex && node tests/run.js instructions
    todos:
      - id: regex-u-flag
        content: Accept the u flag as a no-op in regexCompile — see Regex Unicode
        status: pending
      - id: regex-tables
        content: Add scripts/gen-regex-unicode.mjs and the generated std/regex-unicode.ts tables from the Unicode Character Database — see Regex Unicode
        status: pending
      - id: regex-properties
        content: Compile the property escapes into classes in std/regex.ts — see Regex Unicode
        status: pending
      - id: regex-folding
        content: Fold non-ASCII letters under the i flag by simple case folding — see Regex Unicode
        status: pending
      - id: regex-bench
        content: Add bench/regex and record main against head for patterns with and without the new features — see Performance rule
        status: pending
      - id: regex-docs
        content: Update std/README.md, the nish/regex guide section, docs/security/regex.md and THIRD_PARTY_NOTICES.md — see Regex Unicode
        status: pending
---

# What a JSON Schema validator needs from std

## Context

A prototype validator over `nish/json-value`, `nish/yaml`, `nish/regex`, `codePointLength` and `isIntegral` works on 0.26.0, and the survey of 2026-10-30 found what is still missing. [JsonDocument](../../std/json-value.ts) records no source position, so a validator cannot say `line:column` for JSON. A YAML document lives in a [YamlStream](../../std/yaml.ts), a second data model, and Nish cannot write one function over both (interfaces declare no methods, and `<T extends A>` admits only `A`). [nish/regex](../../std/regex.ts) refuses `\p{…}`, the `u` flag, and folds only ASCII under `i`. Pointers, equality, exact decimals and formats exist nowhere in std.

## Approach

- **The tree is JsonDocument.** YAML is loaded into it rather than a second validator written over YamlStream. Ranges live in JsonDocument so the loader fills the same fields a JSON parse fills, and one [YamlLineIndex](../../std/yaml-lines.ts) turns either text's offsets into `line:column` (it is a plain line index over any text).
- **Opt-in means free when off.** No range array is allocated and no range is stored unless the program asks for ranges. A predictable branch per value is acceptable only if the bench shows it inside the noise band; if it does not, the ranged parse is a separate loop.
- **New modules, not wider old ones.** Pointer, equality, number and format code goes in new files, so the hot modules (`json-tokenizer`, `json-typed`, `yaml`) are untouched and cannot regress.
- **Lookahead and backreferences stay refused.** They are what makes a matcher backtrack; nish/regex's linear-time guarantee is a feature.

## Slicing and shared files

Each stage owns its own new files. Five files are shared, because the repository's rules put a module's README row, guide section, benchmark notes and third-party notice in the same PR as the module: `std/README.md`, `docs/guide/using-nish/standard-library.md`, `bench/README.md`, `docs/BENCHMARKS.md` and `THIRD_PARTY_NOTICES.md`. They are serialized by a merge chain instead of being split: json-ranges → json-pointer-equality-decimal → json-formats → yaml-into-json → regex-unicode. Each stage touches only its own row or section of a shared file, and resolves the small textual conflict when the lead says it is next to merge. Generated files (`tests/self/goldens/checked/**`, `tests/differential/goldens*`, `tests/differential/emit-ts-known.txt`, `package-lock.json`) are regenerated, never hand-merged.

## Performance rule

The owner's hard constraint: **no existing benchmark may get slower.** Every PR in this run carries a before/after table, base `main` at the run's base SHA against the PR head, on the same machine in one session, with the noise band measured the way `.claude/testing.md` → "A `Measured:` trailer" says, and the commit carries the `Measured:` trailer.

| Stage | Must show, main against head |
| --- | --- |
| json-ranges | the new `bench/json-value` parse, ranges off and on; `node bench/json-compare/run.mjs` tokenize and typed rows; `bench/json-tokenizer` and `bench/json-typed` if `std/json-tokenizer.ts` changed |
| yaml-into-json | `node bench/yaml-compare/run.mjs` (yaml.ts is untouched, so this proves it); the new loader's cost per document |
| regex-unicode | the new `bench/regex` over patterns without the new features (literal, class, alternation, quantified, anchored, `i` on ASCII) and with them; the size of a linked program that imports nish/regex without using `\p` |
| every stage | `node tests/run.js instructions` green with `bench/instructions.json` unchanged |

New benches are run by hand (`node bench/<name>/run.mjs`) and are not registered in `tests/run.js`, which no stage owns. A row slower than main beyond its noise band is a blocking review finding. Raising a count in `bench/instructions.json` is a blocking finding.

## JsonDocument ranges

**Stage:** json-ranges. **Owns:** `std/json-value.ts`, `std/json-tokenizer.ts` (only if ranges need it), `tests/link/std_json_value*/**`, `bench/json-value/**`, `bench/README.md`, `docs/BENCHMARKS.md`, `docs/security/json.md`, `std/README.md`, `docs/guide/using-nish/standard-library.md`, generated files. **Merge order:** 1st.


In [std/json-value.ts](../../std/json-value.ts):

```ts
doc.keepRanges = true          // before parse; false by default
doc.start(v): i32              // first byte of v in the parsed bytes, -1 when not recorded
doc.end(v): i32                // one past v's last byte
doc.keyStart(o, i): i32        // object o's member i: its key's range, quotes included
doc.keyEnd(o, i): i32
doc.setRange(v, start, end)    // for a loader that builds with new*
doc.setKeyRange(o, i, start, end)
```

- A value built with `new*` has `-1` until a setter gives it a range. `set` of an existing key keeps the member's key range.
- Ranges are offsets into the bytes `parse` was given (`parseText`: into the string), so `YamlLineIndex(text)` reads them.
- Ranges off: no range arrays exist, `parse` stores nothing extra, and the readers answer `-1`.
- The cost per value with ranges on is stated in the module header next to the 46 bytes it already states, and `docs/security/json.md`'s JSON-10 sizing gets the same figure.

## JSON Pointer, equality, decimals

**Stage:** json-pointer-equality-decimal. **Owns:** `std/json-pointer.ts`, `std/json-equal.ts`, `std/json-number.ts`, `tests/link/std_json_pointer*/**`, `tests/link/std_json_equal*/**`, `tests/link/std_json_number*/**`, `tests/json-schema-suite/**`, `THIRD_PARTY_NOTICES.md`, `std/README.md`, `docs/guide/using-nish/standard-library.md`, generated files. **Merge order:** 2nd, after json-ranges.


| Module | Exports (names are the worker's to settle) | Rules |
| --- | --- | --- |
| `std/json-pointer.ts` | parse into tokens, escape a token, resolve against a JsonDocument, `isJsonPointer`, `isRelativeJsonPointer` | RFC 6901: `~0`/`~1`, array indices without leading zeros, `-` resolves to nothing; relative pointers per the draft JSON Schema cites |
| `std/json-equal.ts` | deep equality, a hash that agrees with it, the index of the first duplicate in an array | numbers equal by mathematical value (`1` = `1.0` = `1e0`), key order ignored, no deep recursion limit worse than the parser's |
| `std/json-number.ts` | exact compare of two number texts, `multipleOf(value, divisor)` | exact on the decimal digits, never through `f64`; an exponent gap past a stated bound is refused with a code, not computed |

`std/README.md` rows, guide sections in `docs/guide/using-nish/standard-library.md`, and the JSON-Schema-Test-Suite (MIT) entry in `THIRD_PARTY_NOTICES.md`.

## Format checks

**Stage:** json-formats. **Owns:** `std/json-format.ts`, `tests/link/std_json_format*/**`, `tests/json-schema-suite-format/**`, `THIRD_PARTY_NOTICES.md`, `std/README.md`, `docs/guide/using-nish/standard-library.md`, generated files. **Merge order:** 3rd, after json-pointer-equality-decimal.


`std/json-format.ts`: `date-time`, `date`, `time` (RFC 3339, leap second rules as the suite tests them), `duration` (RFC 3339 appendix A), `email` (RFC 5321 mailbox), `hostname` (RFC 1123), `ipv4`, `ipv6` (RFC 4291 text forms), `uuid`, `uri`, `uri-reference`, `iri`, `iri-reference`, `uri-template` (RFC 6570), `regex` (compiles under nish/regex). Use [nish/net/url](../../std/net/url.ts) where it is strict enough and say where it is not. One dispatcher answers valid, invalid or unknown by format name; `idn-email`, `idn-hostname` and the pointer formats answer unknown here (the pointer formats live in nish/json-pointer). A `regex` format value nish/regex refuses only for lookaround or backreferences is a documented false negative.

## YAML into JsonDocument

**Stage:** yaml-into-json. **Owns:** `std/yaml-json.ts`, `tests/link/std_yaml_json*/**`, `bench/yaml-json/**`, `bench/README.md`, `std/README.md`, `docs/guide/using-nish/standard-library.md`, generated files. **Starts** when json-ranges has merged (it calls the setters). **Merge order:** 4th, after json-formats.


New `std/yaml-json.ts`: one document of a YamlStream into a JsonDocument, filling `setRange` and `setKeyRange` from the YAML nodes' byte ranges.

- Scalars by the core schema the YamlStream resolves (`null`, `bool`, `int`, `float`, `string`). Hex and octal integers become exact decimal text. `.inf`, `-.inf` and `.nan` have no JSON form: refused with a code and the node's range.
- Aliases are expanded, and the expansion counts against `maxValues`, so an alias bomb is refused with a code, never materialized.
- Merge keys are applied (own keys win, as `pathNode` reads them). A non-string key becomes its source text.
- `yaml.ts` itself is not changed.

## Regex Unicode

**Stage:** regex-unicode. **Owns:** `std/regex.ts`, `std/regex-unicode.ts`, `scripts/gen-regex-unicode.mjs`, `tests/link/std_regex*/**`, `bench/regex/**`, `bench/README.md`, `docs/BENCHMARKS.md`, `docs/security/regex.md`, `THIRD_PARTY_NOTICES.md`, `.claude/licensing.md` (the Unicode License v3 line, if allowed), `std/README.md`, `docs/guide/using-nish/standard-library.md`, generated files. **Merge order:** 5th, after yaml-into-json.


**The owner allowed the Unicode License v3 for the generated tables at sign-off (2026-10-30);** add it to `.claude/licensing.md`'s allowed list with that note, and record the UCD files in `THIRD_PARTY_NOTICES.md`.

- `u` flag: accepted, changes nothing (the syntax is already the `u` flag's).
- `\p{…}` and `\P{…}`: General_Category (long, short and group names), Script and Script_Extensions (`sc=`, `scx=`), and ECMA-262's binary properties, at the Unicode version Node's ICU ships in the CI-pinned Node, so the differential agrees.
- `i`: simple case folding (CaseFolding.txt statuses C and S) for non-ASCII; ASCII folding stays the table it is.
- `scripts/gen-regex-unicode.mjs` fetches the UCD files by URL and sha256 and writes `std/regex-unicode.ts`; the generated file is regenerated, never edited.
- A pattern that uses none of this compiles to the program it compiles to on main.

## Out of scope

- The validator and linter themselves (a later run, outside std).
- Lookahead, lookbehind and backreferences.
- `idn-email`, `idn-hostname` (they need IDNA tables).
- Typed output: string literal unions and nullable scalars.
- Any change to `std/json-tokenizer.ts`, `std/json-typed.ts` or `std/yaml.ts` that is not required by json-ranges.

## Tests

- New link tests under `tests/link/` (discovered by directory, no `tests/run.js` change): `std_json_value_ranges`, `std_json_pointer`, `std_json_equal`, `std_json_number`, `std_json_format`, `std_yaml_json`; extend `std_regex` / `std_regex_f64`. Mirror [tests/link/std_json_value](../../tests/link/std_json_value) for layout.
- JSON-Schema-Test-Suite (MIT), packed the way [tests/yaml-suite](../../tests/yaml-suite) packs the yaml-test-suite (a pinned tarball, a `pack.js --check`, its LICENSE beside it): the draft2020-12 `const`, `enum`, `uniqueItems`, `multipleOf`, `minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum` data into `tests/json-schema-suite/` for json-pointer-equality-decimal, and `optional/format/*` into `tests/json-schema-suite-format/` for json-formats, each with its notice.
- Regex properties and folding checked against Node's `RegExp` with the `u` / `iu` flags over generated code-point samples.
- Every refusal (pointer syntax, exponent bound, YAML `.inf`, alias bomb, unknown property name) has a test.

## Verification

Each stage's `verification` line, plus `node tests/self/goldens.js --update` with its diff read, and the Performance rule table in the PR. The full suite is CI's four `test (…, shard N/4)` rows.
