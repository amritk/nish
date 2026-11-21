# WP70: The surface a Spectral-compatible linter asks for

**Status: proposed, design only; nothing in `runtime/`, `src/` or `std/` is
built.** [LANGUAGE.md](LANGUAGE.md) stays normative. The anchors in this
repository are at `d0f446d1`. The upstream anchors are Spectral at
`16aae2b6f444` (`stoplightio/spectral`), `@stoplight/json` at `d2ad49144e88`,
`@stoplight/yaml` at `10268387a30b`, `@stoplight/yaml-ast-parser` at
`0c4792d1db98`, and vacuum at `0c02c44f17cd` (`daveshanley/vacuum`).

A JSON/YAML style-guide linter is being written in Nish, from scratch rather
than ported. Its inputs are Spectral's: YAML and JSON rulesets (rules may also
be written in Nish and compiled in), and the JSON and YAML documents they
lint. Its output is what Spectral reports, or close to it: the same findings,
at the same ranges, with the same parse diagnostics. Where Spectral and vacuum
disagree, Spectral's behaviour is the default and vacuum's is an option where
it costs little. The language needs nothing new for this; `std/` does. This
note records each gap the design found, what the reference tools do, and what
to build.

| # | Asked for | State at `d0f446d1` | Stage |
| --- | --- | --- | --- |
| 1 | JSON Schema validation against a schema read at run time, with external `$ref`s | Missing | [WP69](wp69-json-schema-runtime.md) |
| 2 | JSON parsed with every value's and key's source range, as jsonc-parser gives them | Built (`parseRanged`); not checked against jsonc-parser | S1 |
| 3 | JSON error recovery: jsonc-parser's errors, its partial tree, comments accepted, duplicate keys reported | Missing | S2 |
| 4 | YAML: `.inf` and `.nan` as numbers, and keys spelled as Spectral spells them | Refused / different | S3 |
| 5 | Zero-based lines and UTF-16 columns | Missing | S4 |
| 6 | String order: Unicode collation | Missing | S5 |
| 7 | Globs: fast-glob's for document arguments, minimatch's for `overrides` | Missing | S6 |
| 8 | Regex lookaround, backreferences and JavaScript's Annex B syntax | Refused by design | Not planned (§7) |

## 1. JSON with source ranges (S1)

Every finding is reported at a range in the source text, and a rule's
`given` path is matched against the parsed tree, so the parser has to keep,
for every value and every key, where it was written.

`JsonDocument` keeps them already. `parseRanged` and `parseTextRanged` parse
as `parse` does and record, in the same pass, each value's byte range (`start`,
`end`) and each member key's, its quotes included (`keyStart`, `keyEnd`)
(`std/json-value.ts:66` to `:93`, `:546`, `:669`). Their cost against a plain
`parse` is recorded: 4.1% to 10.4% more retired instructions on four documents
(`docs/BENCHMARKS.md:632` to `:652`). Offsets are UTF-8 bytes natively and
UTF-16 code units under Node (`std/json-value.ts:74` to `:76`); §4's index
turns them into lines and columns.

What nothing checks is that they are the ranges Spectral reports.
`@stoplight/json` builds its tree from jsonc-parser's visitor
(`src/parseWithPointers.ts:89` to `:218`), and a finding lands at that tree's
node. `tests/link/std_json_value_ranges` checks each range against the bytes it
covers, not against jsonc-parser.

**Build** a differential: every value's and key's range from `parseRanged`
against the offset and length jsonc-parser 2.2 gives the same node, driven as
`@stoplight/json` drives it, over valid documents with every value kind,
nesting, whitespace, escapes, and non-ASCII and astral text, compared in UTF-16
code units. A range that differs is fixed in `parseRanged`, or recorded with
the reason when no finding is placed at that node.

## 2. JSON error recovery, as Spectral sees it (S2)

Spectral parses JSON with `@stoplight/json`'s `parseWithPointers`, called
with `{ ignoreDuplicateKeys: false, preserveKeyOrder: true }`
(`packages/parsers/src/json.ts:6` to `:10`), over jsonc-parser 2.2. Three
behaviours follow, and each is part of the output:

- **Every syntax error is reported, and the rules still run.** jsonc-parser
  recovers after an error and keeps going, each error is a diagnostic with
  jsonc's `ParseErrorCode` and `printParseErrorCode` name
  (`@stoplight/json`, `src/parseWithPointers.ts:210` to `:215`), and the rules
  run over the tree it recovered.
- **Comments are accepted silently.** The default options
  `{ disallowComments: true }` (`parseWithPointers.ts:7` to `:10`) are
  replaced by Spectral's object, which does not set the flag, so a `//` or
  `/* */` comment in a `.json` document is no error. A trailing comma is still
  one (jsonc's `allowTrailingComma` is unset).
- **A duplicate key is a diagnostic**, `DuplicateKey` with code 20, at the
  repeated key's range (`parseWithPointers.ts:122` to `:135`), and the last
  value is the one the tree holds.

`JsonTokenizer` is strict RFC 8259 and its errors are sticky: "The first
error sets `failed`" (`std/json-tokenizer.ts:2`, `:33` to `:35`). It has no
comment handling at all.

Two more behaviours of `@stoplight/json`'s tree follow from its visitor. A
member whose value jsonc-parser could not read is left out of the data: the key
is set as the pending property (`parseWithPointers.ts:143`) and only a value
stores it (`:70` to `:76`). And with `preserveKeyOrder` a repeated key moves to
the end of the object's key order (`swapKey`, `:138` to `:141`, `:282` to
`:291`), where `JSON.parse`, and `JsonDocument` under
`JSON_VALUE_DUPLICATE_LAST`, keep it where it was first written.

**Build**, on top of `parseRanged`'s ranges:

- a recovering mode that answers the list of errors jsonc-parser 2.2 reports
  for the same text, at the same offsets and lengths, and the same partial
  tree, with codes of this module's own, one per jsonc `ParseErrorCode`, so
  the linter maps each to jsonc's name;
- comments accepted, each skipped, as an option the linter turns on;
- duplicate keys reported with the repeated key's range, the last value
  kept, as `JsonDocument` already keeps it under `JSON_VALUE_DUPLICATE_LAST`;
- a nesting-depth limit the caller sets, reported as an error, never a stack
  overflow.

**Done:** a differential against jsonc-parser 2.2, driven as `@stoplight/json`
drives it, over valid and broken documents (truncations, stray and trailing
commas, comments, bad escapes, lone surrogates, deep nesting, duplicate keys).

## 3. YAML as Spectral loads it (S3)

Spectral parses YAML with `@stoplight/yaml`'s `parseWithPointers` with
`mergeKeys: true` and `ignoreDuplicateKeys: false`
(`packages/parsers/src/yaml.ts:13` to `:19`), and `json` mode on by default
(`@stoplight/yaml`, `src/parseWithPointers.ts:599`). `YamlJsonLoader` differs
from it in two ways that change the output:

- **Non-finite numbers.** `.inf`, `-.inf` and `.nan` become the numbers
  `Infinity`, `-Infinity` and `NaN` (`@stoplight/yaml-ast-parser`,
  `src/scalarInference.ts:32` to `:42`), and rules see numbers. The loader
  fails the whole document with `YAML_JSON_ERR_NOT_FINITE`
  (`std/yaml-json.ts:28`, `:630`).
- **Keys.** Spectral spells a key as the string of its resolved value,
  `String(getScalarValue(key))` (`parseWithPointers.ts:114`), so `0x10:` is
  the key `"16"`, `1.0:` is `"1"`, `.inf:` is `"Infinity"` and `~:` is
  `"null"`. The loader keeps a number's or a boolean's source text
  (`std/yaml-json.ts:30` to `:31`). vacuum keeps the source text too (go-yaml's
  `node.Value`), so both spellings have a user.

**Build** two loader options, each off by default so every existing caller is
unchanged:

- **Non-finite numbers load.** A non-finite scalar becomes a number value
  whose `f64` read is ±Infinity or NaN, with an `isFinite` query on the
  document. The number helpers answer what JavaScript answers, because the
  reference engine is JavaScript and WP69 builds on them: `isI64` and
  `isIntegral` are false; in comparisons `-Infinity` is below every number
  and `Infinity` above, and NaN fails every comparison, so neither `minimum`
  nor `maximum` passes for it; NaN equals nothing, itself included, for
  `const`, `enum` and `uniqueItems`, and `Infinity` equals `Infinity`.
  `JsonWriter` and `stringify` write `null`, as `JSON.stringify` does. A
  value copied through an alias or a `<<` merge keeps its anchor's range.
- **Keys spelled as resolved.** A non-string scalar key is spelled as
  JavaScript's `String()` of the value the core schema resolves it to; a big
  integer exactly, as `@stoplight/yaml` keeps it as a `bigint`.

What stays in the linter: Spectral's parse diagnostics. In `json` mode a key
that is not a string scalar is reported as `mapping key must be a string
scalar rather than <type>`, code `YAMLIncompatibleValue`
(`parseWithPointers.ts:313` to `:345`), at the severity
`parserOptions.incompatibleValues` sets, and a repeated key as `duplicate
key` at `parserOptions.duplicateKeys`'s. The linter reads both from the
`YamlStream`'s scalar types and `uniqueKeys` diagnostics, which already exist.

## 4. Zero-based lines and UTF-16 columns (S4)

Spectral's ranges are zero-based lines and characters, and a character is a
UTF-16 code unit: jsonc-parser's `startCharacter` counts them, and
`@stoplight/yaml`'s line map is built over a JavaScript string
(`parseWithPointers.ts`, `computeLineMap`). `YamlLineIndex` answers a 1-based
`line` and a 1-based `column` in characters, every byte that is not a UTF-8
continuation byte (`std/yaml-lines.ts:12` to `:13`, `:22` to `:26`), or
`byteColumn`. The two agree until a line holds a character outside the Basic
Multilingual Plane, which is one character and two UTF-16 units.

**Build** `utf16Column(offset)` and zero-based `line0` and `utf16Column0`,
each no costlier than `column` is today. A caller that wants both reads
`line0` once and counts from its line start; there is no call that returns an
object. The index
is not YAML-specific — `parseRanged`'s ranges need it too — but it keeps its module
and name: moving it would move every pointer to it, for no reader's benefit.

## 5. String order: collation (S5)

Spectral's `alphabetical` compares text with `a.localeCompare(b)`
(`packages/functions/src/alphabetical.ts:21`), in whatever locale the machine
runs. vacuum compares Go strings, `left.Value > right.Value`
(`functions/core/alphabetical.go:68`): byte order, so every capital letter
sorts before every lowercase one. In its `OpenLintV1Draft` mode vacuum uses
`collate.New(language.English)` (`:56`), which agrees with Spectral. Both
compare numbers and numeric strings numerically first, and the linter does
that itself. The case where they differ is the common one, mixed-case tag
names (`Pets`, `store`, `user`).

Nish has no string order at all. `<` refuses strings
(`` Operator `<` requires two numeric operands ``, `docs/LANGUAGE.md:17200`),
and a hand-written loop over `charCodeAt` reads bytes natively but UTF-16
units under Node (`docs/LANGUAGE.md:12674`), so its order differs between the
two outside ASCII.

**Build** `std/collate.ts`:

- **`collateCompare(a, b)`**: the Unicode Collation Algorithm with CLDR's root
  collation (English adds no tailoring to it), tertiary strength and
  non-ignorable variable weighting, which is what Node with full ICU answers
  for `a.localeCompare(b, "en")`. The locale is pinned, so the linter's
  output does not depend on the machine it runs on, which Spectral's does.

Code point order, vacuum's default, is not built: the linter follows
Spectral, and a program that wants a byte order already has one in the
encoded UTF-8. Invalid UTF-8 reads as U+FFFD for each maximal subpart, as
Node's decoder reads it.

The tables are generated by a script from a pinned CLDR release, as
`scripts/gen-regex-unicode.mjs` generates the regex tables and checks their
hash, and the CLDR release is the one in the ICU of the Node that
`.github/workflows/ci.yml` pins, so the differential below is exact. A
program that never calls `collateCompare` carries none of them; the stage
states how much one that does carries. Strings that are all ASCII take a fast
path. The data's licence is handled per `.claude/licensing.md`.

**Done:** CLDR's `CollationTest_CLDR_NON_IGNORABLE.txt` passes; a
differential against Node's `localeCompare(b, "en")` over generated strings
agrees; invalid UTF-8 neither panics nor recurses.

## 6. Globs, in two dialects (S6)

Spectral reads two glob dialects:

- **Document arguments** are expanded by fast-glob 3.2
  (`packages/cli/package.json`, `"fast-glob": "~3.2.12"`) with
  `{ absolute: true, dot: true }`
  (`packages/cli/src/services/linter/utils/listFiles.ts:6` to `:9`). An
  argument that names an existing file is taken as it is, not as a pattern
  (`:25`), and the list is deduplicated and sorted with `localeCompare`
  (`:37`, `:40`, `:81`), so fast-glob's own order never reaches the output.
- **`overrides[].files`** are matched by minimatch 3 with `matchBase: true`
  (`packages/core/src/ruleset/utils/minimatch.ts:3` to `:7`, called at
  `packages/core/src/ruleset/ruleset.ts:209`), so a pattern with no slash
  matches a file's base name in any directory. A `files` entry may end in
  `#` and a JSON Pointer, which the linter splits off before matching.

Nish has `readdirSync` (`docs/LANGUAGE.md:11049`) and no glob.

**Build** `std/glob.ts`: a pattern compiled once and matched against paths,
in either dialect — `*`, `**`, `?`, `[...]` and `[!...]`, nested `{a,b}`,
`{1..3}` where the dialect takes it, the extglobs `!(…)`, `?(…)`, `+(…)`,
`*(…)` and `@(…)`, a leading `!`, backslash escapes, dotfiles as Spectral's options leave them
(fast-glob's `dot: true`, minimatch's default), and minimatch's `matchBase`. Matching is
linear in the path. Expansion walks from the pattern's static prefix with
`readdirSync`, never loops on a symlink cycle, and reaches only `fs.read`. It
answers paths in walk order, deduplicated: `readdirSync` sorts each directory
by bytes, so the order is the same on every machine, and the stage adds no
sort of its own (Spectral's `localeCompare` sort is the caller's to add).
Braces compile to an alternation, not an expansion, so `{a,b}` repeated does
not multiply the pattern, and an argument that names an existing file with no
glob syntax is taken without a walk.

**Done:** differentials against fast-glob 3.2.12 and minimatch 3.1 over a
generated directory tree and a pattern corpus.

## 7. Regex: lookaround, backreferences and Annex B (not planned)

Ruleset patterns (`pattern`'s `match` and `notMatch`, `casing`, a filter's
`.match()`) and schema patterns are compiled by Spectral with JavaScript's
`new RegExp(source)` without the `u` flag (for schemas, ajv's
`unicodeRegExp: false`, [WP69 §3](wp69-json-schema-runtime.md#3-the-reference-spectrals-schema-function)).
`nish/regex` differs in three ways: it refuses lookaround and
backreferences, it applies `u`'s strictness always (a lone `{`, `}` or `]` is
an error), and it takes only the flags `i`, `m`, `s` and `u`
(`std/regex.ts:19` to `:41`).

None of the three changes `nish/regex`:

- **The rules that ship use none of them** but one: Spectral's `oas` and
  `asyncapi` rule sets (`packages/rulesets/src/oas/index.ts`,
  `asyncapi/index.ts`) use no lookaround and no backreference, and their only
  Annex B pattern is a literal `{}` (`notMatch: '{}'`, `oas/index.ts:336`),
  which a rule written for the new linter spells `\{\}`.
- **Backreferences cannot be matched in linear time**, and a bounded
  backtracking path would end the module's one guarantee, "one search … is
  linear in the subject whatever the pattern" (`docs/security/regex.md:11` to
  `:12`), for every program that compiles a pattern an attacker wrote.
- **Lookaround can be matched in linear time**, but not by the lazy DFA that
  makes the module fast, and it is outside the audited scope; it is worth
  building only when real rulesets show they need it.

The linter carries the difference instead: it rewrites a ruleset's Annex B
pattern into the strict form (`\{`, `\}`, `\]`, an identity escape such as
`\-` outside a class to the character), drops the `g`, `y` and `d` flags,
which do not change what a test answers, and reports a pattern that still
does not compile — lookaround, a backreference, a repeat count over 1,000 —
as a finding at ruleset load, with the offset `regexCompile` gives. For the
common `^(?!x-)` its message suggests `notMatch: "^x-"`. WP69 takes the same
rewrite as its pattern translation.

## 8. Stages

- **S1:** `parseRanged`'s ranges checked against jsonc-parser's (§1).
- **S2:** jsonc-parser's recovery, comments accepted, duplicate keys reported,
  a depth limit (§2).
- **S3:** the two `YamlJsonLoader` options: non-finite numbers, and keys
  spelled as resolved (§3).
- **S4:** zero-based lines and UTF-16 columns in `YamlLineIndex` (§4).
- **S5:** `std/collate.ts`, Unicode collation (§5).
- **S6:** `std/glob.ts`, both dialects, and expansion (§6).

S1 comes before S2. The others depend on nothing here, and none waits on
WP69. Each stage lands with its module's doc comments, a `@param` per
parameter and a `@returns`, its `std/README.md` row, its guide page and the
regenerated `docs/reference/`, and moves the pinned `std/<file>.ts:LINE:COL`
references when it edits an existing file.

## 9. Not planned

- Lookaround, backreferences, Annex B syntax and the `g`, `y`, `d` and `v`
  flags in `nish/regex` (§7).
- A JSONC mode beyond what Spectral accepts: trailing commas stay errors.
- Locales other than the pinned one in `collateCompare`, and collation
  strengths other than tertiary.
- The linter's own parts: rulesets and `extends`, JSONPath and filter
  expressions, the rule functions, fixes that keep a document's formatting,
  and the wording of its messages.
