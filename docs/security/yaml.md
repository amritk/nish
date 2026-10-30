# Security record: YAML into a JsonDocument

The record of `nish/yaml-json` (`std/yaml-json.ts`): `YamlJsonLoader.load`
turns one document of a parsed `YamlStream` into a `JsonDocument`, expanding
aliases and applying merge keys. A program loads a config or an OpenAPI
document a peer wrote, so the load is attacker-facing: a few kilobytes of
anchors and aliases can name an exponential tree. It says what the load
refuses and with which code, what bounds its work, and the test that pins
each property. The parser it reads from, `std/yaml.ts`, is not in scope; the
one cost of its that a load inherits is recorded open as YJ-5.

**Anchors.** Every `file:line` below is at `9efc0ea`, on the branch of #1072;
the findings name the commit that fixed each. Round 1 of #1072's review, at
`cee74d4`, found YJ-1 to YJ-3; round 2, at `099862e`, found YJ-4 and YJ-5.

**Result.** The work the loader does is linear in the stream's nodes plus
the values it is allowed to build. Expansion is counted before anything is
built, every map and sequence a merge walks is charged to a budget, and every
refusal has a code and the range of the node that caused it. That is a claim
about the loader, not the parse before it: `parseYaml`'s own merge check walks
a shared merge sequence once per merge key that names it, quadratic in the
text, and that is open (YJ-5). Five findings: four fixed, one open.

## Scope

| File | Functions |
| --- | --- |
| `std/yaml-json.ts` | `YamlJsonLoader`: `load`, `count`, `pushNode`, `pushParts`, `sizeOf`, `partSize`, `plus`, `build`, `tooMuchText`, `buildScalar`, `buildSeq`, `buildMap`, `mergeInto`, `mergeMap`, `newMergeStamp`, `markMerged`, `addEntry`, `findEntry`, `isMergeKey`; `yamlJsonErrorName` |

Out of scope: `std/yaml.ts` (the parser, its anchors and its own merge-value
check) and `std/json-value.ts` (the document, covered by
[json.md](json.md)).

## Threat model

The YAML text is the attacker's. The program chose the `JsonDocument`'s
limits (`maxValues`, `JsonLimits.maxTotalBytes`) and the stream's parse
options. A load must end in time linear in the stream and the limits, never
build past `maxValues` values or `maxTotalBytes` of text, and never recurse
deeper than the loader's `maxDepth` (`std/yaml-json.ts:216`, set to
`JSON_WRITER_MAX_DEPTH`, 64).

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| YJ-1 | Medium | `std/yaml-json.ts:589` (`mergeInto`), `:634` (`mergeMap`) | A merge chain where each map merges the one before twice (`a_k: &a_k {<<: [*a_{k-1}, *a_{k-1}]}`, 61 maps) made the load visit 2^60 maps: `YAML_JSON_MERGE_HOPS` bounded the depth of a merge, not its width, and the count passed because each map holds no values of its own. | **Fixed** in `c0145a7`. A map is merged into a given map at most once (`markMerged`, `:670`, against a stamp per map being built: `newMergeStamp` in `buildMap`, `:548`), and the pairs every merge visits are charged to a budget of `maxValues` plus the stream's node count; past it the load is `YAML_JSON_ERR_EXPANSION` at the merge key. Before: the doubling chain does not finish. After: it loads in under a second. |
| YJ-2 | Low | `std/yaml-json.ts:389` (`sizeOf`) | A map's size subtracted its merge keys from each part's size after adding it, so a part that had saturated at `maxValues + 1` could be taken back under the cap, and the count could pass a document that expands past `maxValues`. The document's own `maxValues` check still refused the build, after the work. | **Fixed** in `c0145a7`: a saturated part keeps the map saturated. |
| YJ-3 | Low | `std/yaml-json.ts:614`, `:622` (`mergeInto`) | A merge key whose value is not a mapping (`<<: 5`, `<<: [1, 2]`, `<<: *scalar`) was skipped by the loader. `parseYaml` already refuses each of these (`YAML_ERR_BAD_MERGE`), so a parsed stream never reached the skip; a stream the parser did not check could. | **Fixed** in `c0145a7`: the loader refuses them too, as `YAML_JSON_ERR_MERGE` at the value. The test reaches the loader's own check, not only the parser's: it parses each shape with `merge` off, so the parser's check is skipped, then turns `stream.merge` on before the load. |
| YJ-4 | Medium | `std/yaml-json.ts:605` (`mergeInto`) | Merging was not linear when a merge value is a shared sequence. `mergeInto` walked a sequence's items once per merge key that names it, and an item already merged into the map was skipped uncharged, so `x: &x {}`, `s: &s [*x, *x, …]` with 100,000 items (about 500 KB) and then about 35,000 maps `{<<: *s}` (about 300 KB) made the loader take about 3.5 × 10^9 steps from about 1 MB of text, all inside the budget YJ-1 added. | **Fixed** in `9efc0ea`: the walk of a merge sequence charges its item count to the same budget before it starts, past which the load is `YAML_JSON_ERR_EXPANSION` at the merge key. Before: the scaled-down test (200 items, 200 maps, `maxValues` 1,000) loaded, and its check read `expected -43, got 8388608`. After: it is refused at `<<: *s`. |
| YJ-5 | Medium | `std/yaml.ts:3232` (`checkMerge`, called by `makePair`, `:3214`) | The parser's merge check has YJ-4's shape and runs first. For every merge pair whose value is a sequence, or an alias to one, `checkMerge` walks the sequence's items to see that each merges a map, so the input of YJ-4 costs about 3.5 × 10^9 steps in `parseYaml` before the loader is called, and the loader's budget never sees it. A program that parses with `merge` off skips the check, and with it merging. | **Open.** `std/yaml.ts` is out of this record's scope and #1072 does not change it. The fix is the parser's to make: check a sequence's items once, when the sequence is finished or the first time a merge names it, and reuse the verdict. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding; the
tests are the checks of `tests/link/std_yaml_json`, run by the check
"link/std_yaml_json: exits with 0 and stdout matches expected.out". Each
check is named by its exact string.

- **An alias bomb is refused before anything is built**: the count
  (`std/yaml-json.ts:305`) runs over the nodes once, saturating at
  `maxValues + 1`, and a document that expands past `maxValues` is
  `YAML_JSON_ERR_EXPANSION` at its largest alias with nothing appended: "bomb:
  a billion laughs is refused", "bomb: at the first alias whose copy is past
  the limit", "bomb: nothing was built", "bomb: one past maxValues is
  refused", "bomb: no alias, too many values"; within the limit, "bomb: an
  expansion within maxValues loads".
- **The text an alias copies is bounded while it is built** (`:474`,
  `tooMuchText`): past `JsonLimits.maxTotalBytes` the load is refused: "text
  bomb: copies of a long string past maxTotalBytes are refused", "text bomb:
  at the copy that does not fit", "text bomb: nothing is kept", "text bomb: no
  alias, too much text".
- **The loader's merging is linear** (YJ-1, YJ-4): "merge bomb: a doubling
  merge chain loads", "merge bomb: in linear time, well under a second",
  "merge bomb: merge visits past the budget are refused", "merge bomb: at the
  merge key it ran out on", "merge bomb: the walks of a shared merge sequence
  are charged", "merge bomb: at the merge key that names the sequence", and
  within the default budget "merge bomb: a shared merge sequence loads within
  the default budget". The parser's side of the same input is YJ-5, open.
- **A map merging itself is refused by the parser**: "merge bomb: a map
  merging itself is refused by the parser" (`YAML_JSON_ERR_YAML`) and "merge
  bomb: at the alias to the unfinished map" (`*a`, since the anchor binds only
  when its map is finished). The loader's own self-guard, `markMerged(at)` in
  `buildMap` (`:549`), is therefore not reached by any test; it stays as the
  guard for a stream the parser did not build.
- **A saturated count stays saturated** (YJ-2): "merge bomb: a saturated
  count stays saturated", "merge bomb: refused by the count, at the root".
- **A merge value that is not a mapping is refused at its range** (YJ-3), five
  shapes, by the parser ("merge shape ${i}: a merge value that is not a
  mapping is refused", "merge shape ${i}: at the value") and by the loader
  itself ("merge shape ${i}: the loader refuses it too", "merge shape ${i}:
  the loader refuses it at the value").
- **With `merge` off, `<<` is an ordinary key**: "merge off: loads", "merge
  off: `<<` is an ordinary key".
- **Depth is bounded** (`:454`; a chain of merges past `YAML_JSON_MERGE_HOPS`
  is the same code, `:595`): "depth: 65 deep is refused", "depth:
  at the one too deep", "depth: 64 deep loads".
- **`.inf`, `-.inf` and `.nan` are refused** with `YAML_JSON_ERR_NOT_FINITE`
  at the scalar (`:497`; "not finite: ${cases[i]} is refused", "not finite:
  ${cases[i]} at its node"; and "not finite: a quoted or tagged one is a
  string"), and an over-long hex or octal integer with
  `YAML_JSON_ERR_NUMBER` ("numbers: a hex integer past 256 digits", "numbers:
  at it").
