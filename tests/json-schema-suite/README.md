# JSON-Schema-Test-Suite, packed

Twelve files of the
[JSON-Schema-Test-Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite)'s
draft 2020-12 tests, in [`cases.txt`](cases.txt), for the keyword helpers
`std/json-equal.ts`, `std/json-number.ts` and `std/json-pointer.ts`. Upstream
is MIT (Copyright (c) 2012 Julian Berman); the licence text is
[`LICENSE-json-schema-test-suite`](LICENSE-json-schema-test-suite), and
`THIRD_PARTY_NOTICES.md` lists the file.

## The pin

`pack.js` pins upstream commit `89e83a74014617ffbe79a56d83d14d054cd11417` and
the sha256 of each file it packs, all under `tests/draft2020-12/`:

| File | Groups | Tests | Read by |
| --- | --- | --- | --- |
| `const.json` | 17 | 54 | `tests/link/std_json_equal` |
| `enum.json` | 16 | 53 | `tests/link/std_json_equal` |
| `uniqueItems.json` | 6 | 69 | `tests/link/std_json_equal` |
| `multipleOf.json` | 5 | 11 | `tests/link/std_json_number` |
| `minimum.json` | 2 | 11 | `tests/link/std_json_number` |
| `maximum.json` | 2 | 8 | `tests/link/std_json_number` |
| `exclusiveMinimum.json` | 1 | 4 | `tests/link/std_json_number` |
| `exclusiveMaximum.json` | 1 | 4 | `tests/link/std_json_number` |
| `optional/bignum.json` | 7 | 9 | `tests/link/std_json_number` |
| `optional/float-overflow.json` | 1 | 1 | `tests/link/std_json_number` |
| `optional/format/json-pointer.json` | 1 | 40 | `tests/link/std_json_pointer` |
| `optional/format/relative-json-pointer.json` | 1 | 26 | `tests/link/std_json_pointer` |

That is 60 groups and 290 tests, every one of them run.

## The format

UTF-8 text, one record per line, `\n` line ends. The first five lines start
with `#` and are the header: the notice, the source pin, the group count and a
sha256 of the record lines, and two lines describing this format. Every other
line is one test group:

```
<file> <group>
```

- `file` is the file's path under `tests/draft2020-12/` without `.json`
  (`const`, `optional/format/json-pointer`).
- `group` is the group's JSON object, `{"description", "schema", "tests"}`,
  exactly as upstream writes it but for the whitespace between tokens, which
  is dropped. Nothing else changes: a number keeps its spelling (`1.0`,
  `1e308`, `-0.0`), which a `JSON.parse` round trip would lose and which these
  tests are about.

Groups are in the table's file order, then upstream's.

## The driver

The driver, [`tests/link/std_json_equal/suite.ts`](../link/std_json_equal/suite.ts),
sits beside the link tests that import it, and is no validator.
`jssRunFile(t, file, tests)` checks
every test of `file`'s groups by calling the helpers directly for the keywords
they answer (`const`, `enum`, `uniqueItems`, `multipleOf`, the four bounds and
the two formats) and reading the few keywords the groups wrap them in (`type`,
`properties`, `required`, `prefixItems`, `items: false`). Any other keyword, or
a helper's refusal, fails the run rather than passing unread. It makes two
checks per file, that every test agrees with upstream's `valid` and that the
file holds the count the caller names.

## Repacking and checking

```
node tests/json-schema-suite/pack.js            # clone the pin into build/json-schema-suite (or reuse it) and rewrite cases.txt
node tests/json-schema-suite/pack.js --check    # verify cases.txt; nothing is fetched or written
```

`--check` checks the header, the group count, each record's shape and the
body against its sha256, and when the cached checkout is at the pinned commit
it also repacks that and compares byte for byte. To move the pin, change `COMMIT`, the
file hashes and `GROUP_COUNT` in `pack.js`, repack, and update the counts in
the table, the link tests and `THIRD_PARTY_NOTICES.md`.
