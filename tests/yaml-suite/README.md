# yaml-test-suite, packed

The [yaml-test-suite](https://github.com/yaml/yaml-test-suite)'s cases, in
[`cases.txt`](cases.txt), for the `std/yaml` conformance run. Upstream is MIT
(Copyright (c) 2016-2020 Ingy döt Net); the licence text is
[`LICENSE-yaml-test-suite`](LICENSE-yaml-test-suite), and
`THIRD_PARTY_NOTICES.md` lists the file.

## The pin

The data is the `yaml-test-suite` npm package at version `0.1.0`, which
repackages upstream's data release as one module per case file. `pack.js` pins
the tarball by URL and sha256:

```
https://registry.npmjs.org/yaml-test-suite/-/yaml-test-suite-0.1.0.tgz
sha256 0f39975dd3410d889837a0ed530008707b009a74ea4450d0be1ff53e2c6e3f32
```

It holds 350 case files and **402 cases** (the count mjst's yaml conformance
test runs against the same package): 94 are errors (upstream's `fail`), 131 have
no expected JSON (the 94 errors and 37 valid cases), and 5 have an expected JSON
that is empty.

## The format

UTF-8 text, one record per line, `\n` line ends. Lines starting with `#` are
the header (the notice, the source pin, the case count and a sha256 of the
record lines, and a description of this format); every other line is a record
of four fields separated by single spaces:

```
<key> <error> <yaml> <json>
```

- `key` is the case ID, four characters of `0-9A-Z` (`229Q`), followed by
  `/<n>` when the ID's file holds more than one case (`DK95/0`, `DK95/1`; `n` is
  the case's 0-based position in the file). Keys are unique and sorted by ID.
- `error` is `1` when a conforming parser must reject `yaml`, else `0`.
- `yaml` is the case's input, and `json` the expected JSON stream upstream's
  `in.json` holds (one or more JSON values, one per document). Either field is
  the bytes of the text with every byte outside `!` to `~` (0x21 to 0x7e), and
  every `%`, written as `%XX` (two upper-case hex digits). An empty text is an
  empty field, so a record can have two spaces in a row.
- `json` is a lone `-` when the case has no expected JSON (every `error` = 1
  case, and 37 valid ones whose events upstream checks instead). A present
  `json` that would be a lone `-` is written `%2D`, so the two never collide.

To read a record, split the line on the space into exactly four fields and
decode the `%XX` escapes in `yaml` and `json`. No field holds a raw space,
newline or `%` that is not an escape.

## Repacking and checking

```
node tests/yaml-suite/pack.js           # fetch (curl) into build/yaml-suite/ if absent, rewrite cases.txt
node tests/yaml-suite/pack.js --check   # nothing is fetched or written; exits 1 on any problem
```

`--check` re-derives `cases.txt` from the cached tarball when
`build/yaml-suite/` holds it and compares byte for byte. Without the cache it
verifies the header's notice, pin and count, the number of records, the body
sha256, and that every record is well formed with a unique key.
