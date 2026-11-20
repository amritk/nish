# WP70: The surface a Spectral-compatible linter asks for

**State:** Proposed · **Done:** 0 of 6 · **Design note:** [`docs/wp70-linter-surface.md`](https://github.com/amritk/nish/blob/main/docs/wp70-linter-surface.md)

## Stages

- [ ] S1: the value and key ranges `JsonDocument.parseRanged` records, checked against jsonc-parser 2.2's as `@stoplight/json` drives it
- [ ] S2: jsonc-parser 2.2's error recovery as `@stoplight/json` drives it: the same errors at the same offsets and the same partial tree, comments accepted, duplicate keys reported, a depth limit
- [ ] S3: two `YamlJsonLoader` options: `.inf`, `-.inf` and `.nan` load as numbers with JavaScript's comparisons and equality and are written as `null`; non-string keys spelled as JavaScript's `String()` of their resolved value
- [ ] S4: zero-based lines and UTF-16 columns in `YamlLineIndex`
- [ ] S5: `std/collate.ts`: `collateCompare` (CLDR root collation, pinned to `en`, what `localeCompare` answers)
- [ ] S6: `std/glob.ts`: fast-glob 3.2's and minimatch 3's dialects, `matchBase`, linear matching, and expansion with `readdirSync`

## Next

S1: [§1](https://github.com/amritk/nish/blob/main/docs/wp70-linter-surface.md#1-json-with-source-ranges-s1). S2 follows it. S3 to S6 depend on nothing here.

## Not planned

Lookaround, backreferences, Annex B syntax and the `g`, `y`, `d` and `v` flags in `nish/regex` (the linter rewrites and reports instead: [§7](https://github.com/amritk/nish/blob/main/docs/wp70-linter-surface.md#7-regex-lookaround-backreferences-and-annex-b-not-planned)), trailing commas in JSON, other locales and strengths of collation, and the linter's own parts.

[All work packages](index.md)
