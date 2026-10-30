# Security record: YAML into a JsonDocument

The record of `nish/yaml-json` (`std/yaml-json.ts`): `YamlJsonLoader.load`
turns one document of a parsed `YamlStream` into a `JsonDocument`, expanding
aliases and applying merge keys. A program loads a config or an OpenAPI
document a peer wrote, so the load is attacker-facing: a few kilobytes of
anchors and aliases can name an exponential tree. It says what the load
refuses and with which code, what bounds its work, and the test that pins
each property. The parser it reads from, `std/yaml.ts`, is not in scope.

**Anchors.** Every `file:line` below is at the commit that added this
record, on the branch of #1072; the findings name the commit that fixed
each. The review that found YJ-1 to YJ-3 was round 1 of #1072, at `cee74d4`.

**Result.** The work a load does is linear in the stream's nodes plus the
values it is allowed to build. Expansion is counted before anything is built,
merges are charged to a budget, and every refusal has a code and the range of
the node that caused it. Three findings, all fixed; none open.

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
deeper than `YAML_JSON_MAX_DEPTH`.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| YJ-1 | Medium | `std/yaml-json.ts` (`mergeInto`, `mergeMap`) | A merge chain where each map merges the one before twice (`a_k: &a_k {<<: [*a_{k-1}, *a_{k-1}]}`, 61 maps) made the load visit 2^60 maps: `YAML_JSON_MERGE_HOPS` bounded the depth of a merge, not its width, and the count passed because each map holds no values of its own. | **Fixed** in `c0145a7`. A map is merged into a given map at most once (`markMerged`, a per-merge stamp on each node), and the pairs every merge visits are charged to a budget of `maxValues` plus the stream's node count; past it the load is `YAML_JSON_ERR_EXPANSION` at the merge key. Before: the doubling chain does not finish. After: it loads in under a second. |
| YJ-2 | Low | `std/yaml-json.ts` (`sizeOf`) | A map's size subtracted its merge keys from each part's size after adding it, so a part that had saturated at `maxValues + 1` could be taken back under the cap, and the count could pass a document that expands past `maxValues`. The document's own `maxValues` check still refused the build, after the work. | **Fixed** in `c0145a7`: a saturated part keeps the map saturated. |
| YJ-3 | Low | `std/yaml-json.ts` (`mergeInto`) | A merge key whose value is not a mapping (`<<: 5`, `<<: [1, 2]`, `<<: *scalar`) was skipped by the loader. `parseYaml` already refuses each of these (`YAML_ERR_BAD_MERGE`), so a parsed stream never reached the skip; a stream the parser did not check could. | **Fixed** in `c0145a7`: the loader refuses them too, as `YAML_JSON_ERR_MERGE` at the value. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding; the
tests are the checks of `tests/link/std_yaml_json`, run by the check
`link/std_yaml_json: exits with 0 and stdout matches expected.out`.

- **An alias bomb is refused before anything is built**: the count runs over
  the nodes once, saturating at `maxValues + 1`, and a document that expands
  past `maxValues` is `YAML_JSON_ERR_EXPANSION` at its largest alias with
  nothing appended (`bomb: …`).
- **The text an alias copies is bounded while it is built**: past
  `JsonLimits.maxTotalBytes` the load is refused (`text bomb: …`).
- **Merging is linear** (YJ-1): `merge bomb: in linear time, well under a
  second`; a map merging itself ends (`merge bomb: a map merging itself is
  refused or loads, never loops`); visits past the budget are refused at a
  merge key (`merge bomb: merge visits past the budget are refused`).
- **A saturated count stays saturated** (YJ-2): `merge bomb: a saturated
  count stays saturated`.
- **A merge value that is not a mapping is refused at its range** (YJ-3):
  `merge shape ${i}: …`, five shapes.
- **Depth is bounded**: 65 levels is `YAML_JSON_ERR_DEPTH`, 64 loads
  (`depth: …`).
- **`.inf`, `-.inf` and `.nan` are refused** with `YAML_JSON_ERR_NOT_FINITE`
  at the scalar, and an over-long hex or octal integer with
  `YAML_JSON_ERR_NUMBER`.
