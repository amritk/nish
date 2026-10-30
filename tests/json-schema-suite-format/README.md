# JSON-Schema-Test-Suite format cases, packed

The [JSON-Schema-Test-Suite](https://github.com/json-schema-org/JSON-Schema-Test-Suite)'s
draft 2020-12 `optional/format` cases, in [`cases.txt`](cases.txt), for the
`std/json-format` link test (`tests/link/std_json_format`). Upstream is MIT
(Copyright (c) 2012 Julian Berman); the licence text is
[`LICENSE-json-schema-test-suite`](LICENSE-json-schema-test-suite), and
`THIRD_PARTY_NOTICES.md` lists the file.

## The pin

The data is the 20 files of `tests/draft2020-12/optional/format/` at the tag
`23.2.0`, one per format, each fetched from

```
https://raw.githubusercontent.com/json-schema-org/JSON-Schema-Test-Suite/23.2.0/tests/draft2020-12/optional/format/<name>.json
```

and pinned by its own sha256 in `pack.js`. The files are fetched one by one
because GitHub's archive hosts, where a tarball of the tag lives, are not
reachable from every build machine, and the suite has no current npm release.
The header of `cases.txt` carries one sha256 over the whole pin: each file's
name and sha256, `<name> <sha256>\n`, in name order.

They hold **478 cases**: 358 whose instance is a string and 120 that are not
(a number, an object, an array, a boolean or null, which every format
accepts, since a format applies to strings alone).

## The format

UTF-8 text, one record per line, `\n` line ends. Lines starting with `#` are
the header (the notice, the source pin, the case count and a sha256 of the
record lines, and a description of this format); every other line is a record
of five fields separated by single spaces:

```
<key> <valid> <kind> <data> <description>
```

- `key` is the format's name, a `/` and the case's 0-based position in its file
  (`date-time/3`). Keys are unique, sorted by name and then by position.
- `valid` is `1` when a validator that checks the format must accept the
  instance, else `0`.
- `kind` is `s` when the instance is a string, and `data` is then the string
  itself; it is `j` otherwise, and `data` is the instance as
  `JSON.stringify` writes it.
- `description` is upstream's description of the case.
- `data` and `description` are the bytes of the text with every byte outside
  `!` to `~` (0x21 to 0x7e), and every `%`, written as `%XX` (two upper-case
  hex digits). An empty text is an empty field.

To read a record, split the line on the space into exactly five fields and
decode the `%XX` escapes in `data` and `description`. No field holds a raw
space, newline or `%` that is not an escape.

## Repacking and checking

```
node tests/json-schema-suite-format/pack.js           # fetch (curl) into build/json-schema-suite-format/ if absent, rewrite cases.txt
node tests/json-schema-suite-format/pack.js --check   # nothing is fetched or written; exits 1 on any problem
```

`--check` re-derives `cases.txt` from the cached files when
`build/json-schema-suite-format/` holds all of them and compares byte for byte.
Without the cache it verifies the header's notice, pin and count, the number of
records, the body sha256, and that every record is well formed with a unique
key naming a pinned file.
