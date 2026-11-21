---
name: WP70 — the surface a Spectral-compatible linter asks for
overview: A JSON/YAML linter written in Nish takes Spectral's inputs and reports what Spectral reports, vacuum's behaviour an option where cheap. The language needs nothing new; std needs JSON ranges checked against jsonc-parser, jsonc-parser's recovery, YAML loaded as Spectral loads it, UTF-16 columns, Unicode collation, and globs in fast-glob's and minimatch's dialects. nish/regex stays as it is; the linter rewrites and reports instead.
spec: docs/wp70-linter-surface.md
priority: 100
labels: [ready]
issue: 2039
stages:
  - id: s1-json-ranges
    title: WP70 S1 — JSON ranges checked against jsonc-parser
    goal: Every value and key range JsonDocument.parseRanged records equals the offset and length jsonc-parser 2.2 gives the same node, driven as @stoplight/json drives it, in UTF-16 units; a difference is fixed or recorded with its reason.
    verification: node tests/run.js json && npm run check && npm run lint && node scripts/gen-reference.mjs --check
    issue: 2040
    todos:
      - id: s1-reference
        content: Add the scripts/ generator that runs jsonc-parser 2.2 in a scratch directory and commits its ranges as fixtures — see WP70 S1
        status: pending
      - id: s1-differential
        content: Add the range differential over valid documents (every value kind, nesting, whitespace, escapes, non-ASCII and astral text) — see WP70 S1
        status: pending
      - id: s1-fixes
        content: Fix each differing range in std/json-value.ts parseRanged or record why no finding lands there; regenerate pinned std/json-value.ts LINE:COL references — see WP70 S1
        status: pending
  - id: s2-json-recovery
    title: WP70 S2 — jsonc-parser's recovery, as @stoplight/json drives it
    goal: nish/json-recover, run only on a document parseRanged refuses, answers jsonc-parser 2.2's errors at the same offsets and lengths and @stoplight/json's partial tree, accepts comments as an option, reports duplicate keys at the repeated key with the last value at the first position, and stops at a caller-set depth of at most 64 with an error.
    verification: node tests/run.js json && npm run check && npm run lint && node scripts/gen-reference.mjs --check && node scripts/security-scope.mjs
    issue: 2041
    todos:
      - id: s2-reader
        content: Add std/json-recover.ts building a JsonDocument with ranges, one error code per jsonc ParseErrorCode, depth default and maximum 64 — see WP70 S2
        status: pending
      - id: s2-differential
        content: Add the broken-document corpus and the differential against jsonc-parser 2.2 fixtures driven as @stoplight/json drives it — see WP70 S2
        status: pending
      - id: s2-docs
        content: Add the std/README row, doc comments, the reference page and route, and the guide section — see WP70 S2
        status: pending
      - id: s2-security
        content: Add the reader to docs/security/json.md's scope with its findings, and update its docs/security/README.md row — see WP70 S2
        status: pending
  - id: s3-yaml
    title: WP70 S3 — YAML as Spectral loads it
    goal: Two YamlJsonLoader options, non-finite numbers that load with JavaScript's comparisons and equality, and non-string keys spelled as String() of their resolved value, both off by default, the source-text spelling staying the default.
    verification: node tests/run.js yaml && node tests/run.js json && npm run check && npm run lint && node scripts/gen-reference.mjs --check
    issue: 2042
    todos:
      - id: s3-nonfinite
        content: Add the non-finite option and what isI64, isIntegral, jsonEqual, jsonNumberCompare and JsonWriter answer for it — see WP70 S3
        status: pending
      - id: s3-keys
        content: Add the resolved-key option, big integers exact — see WP70 S3
        status: pending
      - id: s3-docs
        content: Update the guide's Loading YAML into a JsonDocument section, std/README rows and the regenerated reference pages; regenerate pinned std/yaml-json.ts and std/json-*.ts LINE:COL references — see WP70 S3
        status: pending
  - id: s4-columns
    title: WP70 S4 — zero-based lines and UTF-16 columns
    goal: YamlLineIndex answers line0, utf16Column and utf16Column0, each no costlier than column, the same natively and under Node.
    verification: node tests/run.js yaml && npm run check && npm run lint && node scripts/gen-reference.mjs --check
    issue: 2043
    todos:
      - id: s4-index
        content: Add line0, utf16Column and utf16Column0 to std/yaml-lines.ts with tests for astral characters, CR LF, lone CR, offsets past the end and inside a UTF-8 sequence — see WP70 S4
        status: pending
      - id: s4-docs
        content: Regenerate docs/reference/yaml-lines.md and update the guide's nish/yaml section — see WP70 S4
        status: pending
  - id: s5-collate
    title: WP70 S5 — std/collate.ts, Unicode collation
    goal: A nish/collate module with one function, collateCompare, equal to Node's localeCompare(b, "en") under the ci.yml Node, invalid UTF-8 read as U+FFFD, its tables generated by a pinned script.
    verification: node tests/run.js collate && npm run check && npm run lint && node scripts/gen-reference.mjs --check
    issue: 2044
    todos:
      - id: s5-tables
        content: Add the table generator with a pinned CLDR release and hash, the ASCII fast path, and record the size a program that calls collateCompare carries — see WP70 S5
        status: pending
      - id: s5-tests
        content: Pass CollationTest_CLDR_NON_IGNORABLE, add the Node differential and the invalid UTF-8 tests (U+FFFD order, no panic) — see WP70 S5
        status: pending
      - id: s5-docs
        content: Add the std/README row, reference page, guide section, a pointer from the strings guide, and the CLDR licence in THIRD_PARTY_NOTICES.md — see WP70 S5
        status: pending
  - id: s6-glob
    title: WP70 S6 — std/glob.ts, fast-glob's and minimatch's dialects
    goal: A nish/glob module that compiles a pattern once in fast-glob 3.2's or minimatch 3's dialect, matches in time linear in the path, and expands under fs.read only in readdirSync walk order without looping on a symlink cycle.
    verification: node tests/run.js glob && npm run check && npm run lint && node scripts/gen-reference.mjs --check
    issue: 2045
    todos:
      - id: s6-matcher
        content: Add the matcher in both dialects, braces as alternation, and its differentials against fast-glob 3.2.12 and minimatch 3.1 fixtures — see WP70 S6
        status: pending
      - id: s6-expand
        content: Add expansion in walk order with the literal-file shortcut, and its capability test — see WP70 S6
        status: pending
      - id: s6-docs
        content: Add the std/README row, reference page, guide section, and docs/security/glob.md with its index row — see WP70 S6
        status: pending
---

# WP70 — the surface a Spectral-compatible linter asks for (plan)

## Context

A JSON/YAML style-guide linter is being written in Nish with Spectral's inputs and Spectral's output; where vacuum differs, vacuum's behaviour is an option where it costs little. The language needs nothing new; `std/` does. The [design note](../../docs/wp70-linter-surface.md) records each gap, what the reference tools do at pinned commits, and what to build. JSON Schema at run time is [WP69](../../docs/wp69-json-schema-runtime.md); regex is not planned ([§7](../../docs/wp70-linter-surface.md#7-regex-lookaround-backreferences-and-annex-b-not-planned)). S1 comes before S2; S3 to S6 depend on nothing here and none waits on WP69. Each stage lands in its own PR, which closes its issue.

## WP70 S1 — JSON ranges checked against jsonc-parser

Spec: [§1](../../docs/wp70-linter-surface.md#1-json-with-source-ranges-s1), table row 2.

**What exists.** `JsonDocument.parseRanged` and `parseTextRanged` (`std/json-value.ts`) record each value's byte range and each member key's, quotes included, in the same pass as `parse`; their cost is in `docs/BENCHMARKS.md` (4.1% to 10.4% more instructions). Offsets are UTF-8 bytes natively and UTF-16 units under Node. `tests/link/std_json_value_ranges` checks each range against the bytes it covers. Nothing checks them against jsonc-parser, whose visitor builds the tree a Spectral finding lands on (`@stoplight/json` `src/parseWithPointers.ts:89` to `:218`).

**Build** a differential: every value's and key's range from `parseRanged` against the offset and length jsonc-parser 2.2 gives the same node, driven through `visit` as `@stoplight/json` drives it, over valid documents with every value kind, nesting, whitespace, escapes, and non-ASCII and astral text, compared in UTF-16 units. A range that differs is fixed in `parseRanged`, or recorded in the test with the reason when no finding is placed at that node.

**Done:** the differential passes in `node tests/run.js json`.

**Duties.** No new module. A fix that moves lines in `std/json-value.ts` regenerates every pinned `std/json-value.ts:LINE:COL` (`tests/link/*/expected.caps.json`, `tests/wordings/*.err`, `docs/reference/diagnostics/`) and `docs/reference/json-value.md`. The guide's `nish/json-value` section in `docs/guide/using-nish/standard-library.md` changes only if a range a user sees changes. Security: `parseRanged` is already in `docs/security/json.md`'s scope (JSON-10); a code change updates that record's anchors, and no new record is needed.

### Decided

**The reference tools enter the tests as generated fixtures** (shared with S2 and S6). A script under `scripts/` installs the pinned versions (jsonc-parser 2.2 here; fast-glob 3.2.12 and minimatch 3.1 for S6) in a scratch directory, runs them over the corpus and commits the expected outputs; `tests/run.js` reads the fixtures, so CI and every install carry no new dependency. A version bump is a rerun of the script. Not chosen: pinned devDependencies run live.

## WP70 S2 — jsonc-parser's recovery, as @stoplight/json drives it

Spec: [§2](../../docs/wp70-linter-surface.md#2-json-error-recovery-as-spectral-sees-it-s2), table row 3. Needs S1's ranges checked first.

**What Spectral does.** It parses JSON with `@stoplight/json`'s `parseWithPointers` and `{ ignoreDuplicateKeys: false, preserveKeyOrder: true }` over jsonc-parser 2.2. Every syntax error is a diagnostic with jsonc's `ParseErrorCode` and name, and the rules run over the recovered tree. Comments are accepted silently; a trailing comma is still an error. A duplicate key is `DuplicateKey`, code 20, at the repeated key's range. A member whose value could not be read is left out of the data. Under `preserveKeyOrder` a repeated key moves to the end of the key order (`swapKey`). `JsonTokenizer` is strict, its first error is sticky, and it has no comments.

**Build** `std/json-recover.ts` (`nish/json-recover`), a recovering reader that builds a `JsonDocument` through `setRange` and `setKeyRange`, leaving the audited strict `JsonTokenizer` and parse loops untouched. Valid JSON stays on the strict path: the linter calls `parseRanged` first and runs the recovering reader only on a document it refuses, as mjst's linter takes `JSON.parse` first and builds a jsonc-parser tree only for a rejected document (`packages/lint/src/parsers/json.ts`), so a valid document pays nothing for recovery. The reader answers:
- the list of errors jsonc-parser 2.2 reports for the same text, at the same offsets and lengths, with codes of its own, one per jsonc `ParseErrorCode`, so the linter maps each to jsonc's name;
- the same partial tree `@stoplight/json` builds, members without a value left out;
- comments accepted and skipped, as an option the caller turns on;
- duplicate keys reported at the repeated key's range, the last value kept at the key's first position, as `parseRanged` keeps it under `JSON_VALUE_DUPLICATE_LAST`, so both paths give one tree;
- a nesting-depth limit the caller sets, default and maximum 64 (`JSON_WRITER_MAX_DEPTH`), reported as an error, never a stack overflow.

**Done:** a differential against jsonc-parser 2.2, driven as `@stoplight/json` drives it, over valid and broken documents (truncations, stray and trailing commas, comments, bad escapes, lone surrogates, deep nesting, duplicate keys), errors and tree both compared.

**Duties.** A `std/README.md` row; a doc comment with `@param` and `@returns` on every public declaration; `docs/reference/json-recover.md` and its route, written by `node scripts/gen-reference.mjs`; a `## nish/json-recover` section in `docs/guide/using-nish/standard-library.md` and its row in the module table there. Security: **yes**. It is a new scanner over untrusted text: it lands in `docs/security/json.md`'s scope with its findings (depth, recovery loops that must terminate, comment and surrogate handling), each fixed with a before/after test or recorded open, and the record's row in `docs/security/README.md` moves with its counts. `scripts/security-scope.mjs` does not enforce this for `std/json-*`; the record does.

### Decided

- **A new module, `nish/json-recover`,** not a mode in `JsonTokenizer` or `JsonDocument`, so no strict caller's audited path gains recovery branches.
- **Depth: caller-set, default and maximum 64,** the writer's cap. A document deeper than 64 is a reported error that Spectral does not give (and mjst's linter allows to 1,000, `packages/lint/src/parsers/depth.ts`); the module's docs and its test record the divergence. Not chosen: raising the writer's cap, which re-audits its recursion.
- **A repeated key stays at its first position** with the last value, as `JSON.parse`, mjst's linter and `JSON_VALUE_DUPLICATE_LAST` keep it, chosen for one tree on both paths at no cost: the duplicate pass already marks one pending member gone per repeat (`std/json-value.ts`, `repeat`), and keeping the first costs the same as keeping the last. Spectral's `preserveKeyOrder` moves the key to the end (`swapKey`); a rule that walks keys in order can differ from Spectral's on such a document, and the module's docs record it.
- **jsonc-parser 2.2 enters the tests as generated fixtures,** as S1 settles.

## WP70 S3 — YAML as Spectral loads it

Spec: [§3](../../docs/wp70-linter-surface.md#3-yaml-as-spectral-loads-it-s3), table row 4.

**What differs.** Spectral loads `.inf`, `-.inf` and `.nan` as the numbers `Infinity`, `-Infinity` and `NaN`; `YamlJsonLoader` fails the whole document with `YAML_JSON_ERR_NOT_FINITE`. Spectral spells a non-string key as `String()` of its resolved value (`0x10:` is `"16"`, `1.0:` is `"1"`, `~:` is `"null"`); the loader keeps the source text, as vacuum does (go-yaml's `node.Value`), so both spellings have a user.

**Build** two `YamlJsonLoader` options, each off by default:
- **Non-finite numbers load.** A non-finite scalar becomes a number value whose `f64` read is ±Infinity or NaN, with an `isFinite` query on the document. `isI64` and `isIntegral` are false; `-Infinity` sorts below every number and `Infinity` above; NaN fails every comparison, so neither `minimum` nor `maximum` passes for it; NaN equals nothing, itself included, for `const`, `enum` and `uniqueItems`, and `Infinity` equals `Infinity`. `JsonWriter` and `stringify` write `null`, as `JSON.stringify` does. A value copied through an alias or a `<<` merge keeps its anchor's range.
- **Keys spelled as resolved.** A non-string scalar key is spelled as JavaScript's `String()` of the value the core schema resolves it to; a big integer exactly, as `@stoplight/yaml` keeps it as a `bigint`.

Spectral's parse diagnostics (`YAMLIncompatibleValue`, `duplicate key`) stay in the linter, read from `YamlStream`'s scalar types and `uniqueKeys` diagnostics, which exist.

**Done:** tests in `node tests/run.js yaml` and `json` for each answer above, natively and under Node, and every existing caller unchanged with both options off.

**Duties.** No new module. Regenerate `docs/reference/yaml-json.md` and the reference pages of the number helpers whose doc comments change; update the guide's "Loading YAML into a JsonDocument" section in `docs/guide/using-nish/standard-library.md` and the `std/README.md` rows; regenerate every pinned `std/yaml-json.ts:LINE:COL` and `std/json-*.ts:LINE:COL`. Security: no new record. The stage adds no text scanning (the YAML parser is unchanged), `nish/yaml` has no record, and it is outside `scripts/security-scope.mjs`'s surface; the stage says so in its PR.

### Decided

**The default key spelling stays the source text,** vacuum's and today's, so every existing caller is unchanged; Spectral's resolved spelling is the option the linter turns on (mjst's linter spells keys resolved, `String(v)`, in `packages/yaml/src/parse-document.ts`). Not chosen: flipping the default.

## WP70 S4 — zero-based lines and UTF-16 columns

Spec: [§4](../../docs/wp70-linter-surface.md#4-zero-based-lines-and-utf-16-columns-s4), table row 5.

**What differs.** Spectral's ranges are zero-based lines and characters, a character being a UTF-16 code unit (jsonc-parser's `startCharacter`; `@stoplight/yaml`'s line map over a JavaScript string). `YamlLineIndex` (`std/yaml-lines.ts`) answers a 1-based `line` and a 1-based `column` that counts every byte that is not a UTF-8 continuation byte, or `byteColumn`. They differ on a line with a character outside the Basic Multilingual Plane: one character, two UTF-16 units.

**Build** `line0(offset)`, `utf16Column(offset)` (1-based, beside `column`) and `utf16Column0(offset)` on `YamlLineIndex`, each no costlier than `column`, answering the same natively (counting from UTF-8 bytes) and under Node (where offsets are already UTF-16 units). The index keeps its module and name; it serves `parseRanged`'s ranges too.

**Done:** tests with astral characters, CR LF, a lone CR, an offset past the end and an offset inside a UTF-8 sequence, natively and under Node.

**Duties.** No new module. Doc comments with `@param` and `@returns`, `docs/reference/yaml-lines.md` regenerated, and the guide's `nish/yaml` section updated where it names `line` and `column`. Security: no record; the accessors read no input text and clamp offsets.

### Decided

**The names are `line0`, `utf16Column` and `utf16Column0`,** the design note's sketch, beside the existing `line` and `column`. A caller that needs both a line and its column, as mjst's `positionAt` answers them in one call (`packages/lint/src/parsers/lines.ts`), reads `line0` once and counts from `lineStart`, so one position costs one line search; the stage measures that path. Not chosen: one call answering a `{ line, character }` object, which allocates per position.

## WP70 S5 — std/collate.ts, Unicode collation

Spec: [§5](../../docs/wp70-linter-surface.md#5-string-order-collation-s5), table row 6.

**What differs.** Spectral's `alphabetical` compares with `a.localeCompare(b)` in the machine's locale; vacuum compares Go strings (byte order, every capital before every lowercase letter), and in `OpenLintV1Draft` mode uses `collate.New(language.English)`. Nish has no string order: `<` refuses strings, and a `charCodeAt` loop reads bytes natively and UTF-16 units under Node.

**Build** `std/collate.ts` (`nish/collate`) with one function, `collateCompare(a, b)`: the Unicode Collation Algorithm with CLDR's root collation, tertiary strength, non-ignorable, which Node with full ICU answers for `a.localeCompare(b, "en")`; the locale is pinned, so output never depends on the machine. Invalid UTF-8 reads as U+FFFD per maximal subpart, as `TextDecoder` does, in the same pass that decodes, so a native string sorts as its Node decoding does.

The tables come from a script with a pinned CLDR release and hash, as `scripts/gen-regex-unicode.mjs` does; the release is the one in the ICU of the Node `.github/workflows/ci.yml` pins, so a Node bump there regenerates the tables. All-ASCII strings take a fast path. A program that never calls `collateCompare` carries no table; the stage records how much one that does carries.

**Done:** CLDR's `CollationTest_CLDR_NON_IGNORABLE.txt` passes; a differential against Node's `localeCompare(b, "en")` over generated strings agrees; invalid UTF-8 sorts as its U+FFFD decoding and neither panics nor recurses.

**Duties.** New module: a `std/README.md` row; doc comments with `@param` and `@returns`; `docs/reference/collate.md` and its route via `node scripts/gen-reference.mjs`; a `## nish/collate` section and module-table row in `docs/guide/using-nish/standard-library.md`; a pointer from the guide's strings page where it says `<` refuses strings. The CLDR data's licence (Unicode License v3) goes in `THIRD_PARTY_NOTICES.md` per `.claude/licensing.md`. Security: no record. It reads no network, terminal or other process, and is outside `scripts/security-scope.mjs`'s surface; the invalid-UTF-8 tests pin that hostile strings never panic.

### Decided

- **Only `collateCompare` ships;** there is no `compareCodePoints`. vacuum's default byte order is not offered, and its `OpenLintV1Draft` English collation is served by `collateCompare`, exact up to the CLDR version difference between Go's `x/text` and Node's ICU, which the docs record. mjst's linter likewise compares with bare `localeCompare` after its numeric check (`packages/lint/src/functions/alphabetical.ts`); the numeric check stays the linter's.
- **Invalid UTF-8 reads as U+FFFD** per maximal subpart, as `TextDecoder` does: one decoding pass, and the Node differential can test it. Not chosen: raw bytes ordered after valid text, which no Node answer pins.

## WP70 S6 — std/glob.ts, fast-glob's and minimatch's dialects

Spec: [§6](../../docs/wp70-linter-surface.md#6-globs-in-two-dialects-s6), table row 7.

**What Spectral does.** Document arguments are expanded by fast-glob 3.2.12 with `{ absolute: true, dot: true }`; an argument that names an existing file is taken literally; the list is deduplicated and sorted with `localeCompare`, so fast-glob's own order never reaches the output (`packages/cli/src/services/linter/utils/listFiles.ts:6` to `:9`, `:25`, `:37`, `:40`, `:81`). `overrides[].files` are matched by minimatch 3 with `matchBase: true`, so a pattern with no slash matches a base name in any directory; a trailing `#` and JSON Pointer is the linter's to split off. Nish has `readdirSync` and no glob.

**Build** `std/glob.ts` (`nish/glob`): a pattern compiled once and matched against paths in either dialect — `*`, `**`, `?`, `[...]` and `[!...]`, nested `{a,b}`, `{1..3}` where the dialect takes it, the extglobs `!(…)`, `?(…)`, `+(…)`, `*(…)` and `@(…)`, a leading `!`, backslash escapes, dotfiles as Spectral's options leave them (fast-glob's `dot: true`, minimatch's default) and minimatch's `matchBase`. Matching is linear in the path. Brace groups compile to alternation inside the matcher, never to a cartesian expansion (mjst's `packages/lint/src/core/glob.ts` records `'{a,b}'.repeat(22)` taking 40 s as an expansion). Expansion walks from the pattern's static prefix with `readdirSync`, never loops on a symlink cycle, and reaches only `fs.read`. It answers paths in walk order, deduplicated and never re-sorted: `readdirSync` already answers each directory sorted by bytes (`docs/LANGUAGE.md`), so the order is reproducible on every file system at no extra cost. An argument with no glob syntax that names an existing file is taken as it is without a walk, as Spectral (`listFiles.ts:25`) and mjst (`packages/cli/src/lint/run.ts`) do. A caller that wants Spectral's `localeCompare` order sorts with `collateCompare` (S5).

**Done:** differentials against fast-glob 3.2.12 and minimatch 3.1 over a generated directory tree and a pattern corpus, as generated fixtures (S1), and a capability test showing expansion needs only `fs.read`.

**Duties.** New module: a `std/README.md` row; doc comments with `@param` and `@returns`; `docs/reference/glob.md` and its route via `node scripts/gen-reference.mjs`; a `## nish/glob` section and module-table row in `docs/guide/using-nish/standard-library.md` that names the `fs.read` capability; a `tests/link` case with `expected.caps.json`. Security: **yes**, a new `docs/security/glob.md` and its row in `docs/security/README.md`. Patterns come from rulesets a user did not write, so the record states the linear-time claim as `docs/security/regex.md` does, with the pattern-size and brace-expansion limits, and the walk's handling of symlink cycles and paths outside the root. `scripts/security-scope.mjs` does not require it; the record is this plan's duty.

### Decided

- **fast-glob 3.2.12 and minimatch 3.1 enter the tests as generated fixtures,** as S1 settles.
- **Expansion answers walk order,** the order `readdirSync` gives each directory (bytes), with no sort of its own, as mjst's CLI passes fast-glob's order through unsorted; the linter re-sorts with `collateCompare` where it matches Spectral. Not chosen: a code point sort inside `nish/glob`, or `collateCompare` inside it, which would couple S6 to S5 and carry the collation tables into every program that globs.

## Out of scope

Regex lookaround, backreferences and Annex B ([§7](../../docs/wp70-linter-surface.md#7-regex-lookaround-backreferences-and-annex-b-not-planned)); what the design note's [§9](../../docs/wp70-linter-surface.md#9-not-planned) lists; the linter itself; JSON Schema at run time (WP69).
