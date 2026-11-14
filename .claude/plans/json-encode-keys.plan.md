---
name: Typed JSON serialize — write a field's key in one step
overview: Close the typed-serialize gap in docs/BENCHMARKS.md ("serialize, citm_catalog.json": Nish 2.02x slower than serde_json, 3.4x slower than simdjson's hand-written builder) by profiling jsonEncode first, then removing the per-field cost the profile names — most likely the run-time escaping and state checks behind `w.key("<wireName>")` — so every jsonEncode of any class gains, not only citm.
stages:
  - id: json-encode-keys
    title: "perf(codegen): write a typed object's keys as one pre-escaped copy"
    goal: jsonEncode of any class spends measurably fewer instructions per document, shown by callgrind Ir and by bench/json-compare serialize read against its byte-identical-copy band, on citm_catalog.json and on a small API-style response program, with byte-identical output.
    verification: "npm run check && npm run lint && npm run lint:dead && node scripts/gen-reference.mjs --check && node docs/check-links.mjs && node tests/run.js json && node tests/run.js wasi && node tests/run.js performance && node tests/nish-cmp.js && node tests/self/goldens.js"
    todos:
      - id: baseline-profile
        content: Build main, take callgrind Ir per document for typed serialize of citm_catalog.json and of the API-style program, and attribute the Ir by function (key, jsonWriterPutString, value-due/done checks, number formatting) before changing any code — see Profile first
      - id: key-constant
        content: Have emitJsonEncodeBody (src/emit-json.ts) pass a compile-time pre-escaped `"name":` constant (and `,"name":` if the profile justifies it) to a new @internal JsonWriter method in std/json.ts that does the state checks once and copies the bytes in one step; fall back to key() when the writer indents — see The key constant
      - id: value-path
        content: If the profile shows the value calls (jsonWriterValueDue/ValueDone, number writing) as a large share after the key change, take the next cheap step there; otherwise record why not — see Values and numbers
      - id: api-program
        content: Add a small non-bench API-style response program (nested object, array of records, strings, numbers, bool, null) with a golden output, and measure it before and after — see Real-world, not bench-shaped
      - id: tests
        content: Tests that pin byte-identical output for keys needing escapes, indenting writers, empty classes, tagged variants, nested and failed writers; a positive tests/cases entry registered with node tests/differential/goldens.js --update; regenerate tests/self/goldens/checked/ — see Tests
      - id: ratchets
        content: nish-cmp DECLARED entries for every corpus program whose IR moves; docs/reference regenerated if std/json.ts's public surface or doc text moves; wasi and performance runs clean — see Definition of done
      - id: measure-and-record
        content: callgrind Ir per document before/after and node bench/json-compare/run.mjs serialize against its byte-identical-copy band; Measured trailer in the commit; a json-encode-keys note in docs/BENCHMARKS.md in the style of the json-writer-bytes note — see Measure and record
---

# Typed JSON serialize — write a field's key in one step

## Context

`docs/BENCHMARKS.md` → "JSON against other languages" → *serialize,
citm_catalog.json*: Nish 675,503 ns/doc (min), serde_json 333,892 (2.02x),
simdjson's hand-written builder 198,651 (3.40x); band 1.4% on minimums.

Suspected cause, **to be verified by a profile before any change**:
`emitJsonEncodeBody` (`src/emit-json.ts`, ~line 1618) emits
`w.key("<wireName>")` per field. `JsonWriter.key` (`std/json.ts`, ~line 1151)
runs five state checks (failed, depth/done, inObject, afterKey, sep) and then
`jsonWriterPutString` (~line 1650), which escapes the key one byte at a time,
although the compiler knows the key at compile time. Each value call (`w.i32`
etc.) then runs `jsonWriterValueDue` / `ValueDone` again. The S6a escape
kernel (#875) did not move this row because citm's strings are mostly shorter
than 16 bytes (see the json-writer-bytes note in BENCHMARKS.md).

Base: `main` at `d38a94b00543bd87481a6fa811ecc5802ba36d92`.

## Profile first

**Owns:** `src/**`, `std/**`, `runtime/nish.d.ts`, `tests/**`, `bench/json-compare/**`, `bench/json-api/**` (new), `docs/BENCHMARKS.md`, `docs/wp38-simd.md`, `docs/IR_COOKBOOK.md`, `docs/cookbook/**`, `docs/reference/**`, `scalar.config.json`, `scripts/undocumented.txt`

- Callgrind on a build of `main`: Ir per document for citm typed serialize and
  for the API-style program, split by function. Keep the numbers; the PR body
  shows them.
- If the profile says the key path is *not* the dominant per-field cost, say
  so in the PR body and fix what it does name. Do not ship the key change on
  the strength of this plan's guess.

## The key constant

- The emitter knows each field's wire name. Escape it at compile time into a
  constant `"name":` (quotes, escapes and colon included), and possibly a
  second `,"name":` for every field after the first in a non-indenting writer.
- A new `@internal` JsonWriter method (std/json.ts) takes that constant:
  one combined state check, then one copy (a `memcpy`-style append, growing the
  buffer once). It must leave the writer in exactly the state `key()` leaves
  it: `afterKey`, `sep`, `failed` codes on every misuse path.
- When the writer indents (`sep` is neither NONE nor COMMA) fall back to
  `key()`, so indented output does not change.
- The method is `@internal`: not part of the public surface, not in
  docs/reference. If gen-reference or knip complains, follow their rules; do
  not add it to `scripts/undocumented.txt`.
- `src/` may not use a construct or builtin the seed does not have (rolling
  freeze). An `@internal` std method called only from emitted IR is fine.

## Values and numbers

After the key change, re-profile. If `jsonWriterValueDue` / `ValueDone` or
integer/float formatting is now a large share, take the next cheap step (for
example a value-after-key entry that skips checks the key method already
made). Anything not taken is recorded in the PR body with its share.

## Real-world, not bench-shaped

Every `jsonEncode` of a class goes through `emitJsonEncodeBody`, so the gain
must show outside citm. Add a small API-style program (for example
`bench/json-api/` or a tests/cases entry): a response object with an id,
strings, a nested object, an array of a few records, numbers, a bool and a
null, encoded in a loop. Measure its Ir per encode before and after.

## Tests

- Output is byte-identical to `main` for every program: keys that need
  escaping (quote, backslash, control byte, non-ASCII), an indenting writer,
  an empty class, a tagged-union variant (the tag key goes first), nested
  classes, `| null` fields, arrays and maps of classes, and a writer that has
  already failed (depth 65).
- A positive `tests/cases/*` lands with `.ll`, `.out`, and is registered with
  `node tests/differential/goldens.js --update`. Show its exact IR in the PR.
- Regenerate `tests/self/goldens/checked/` with
  `node tests/self/goldens.js --update` and read the diff.

## Definition of done

CLAUDE.md's: `npm run check`, `npm run lint`, targeted `node tests/run.js`
sections (`json`, the new case), `wasi` (with `WASI_SYSROOT=/usr`, read its
skip line) and `performance` for the `src/` change; nish-cmp with narrow
`DECLARED` entries for every corpus program whose IR moves (program + file,
the PR's release-note words); `node scripts/gen-reference.mjs --check`.
CI's eight shards are the full-suite gate.

## Measure and record

- callgrind Ir per document, before and after, for citm and the API program.
- `node bench/json-compare/run.mjs` serialize, interleaved, read against the
  byte-identical-copy band (`.claude/testing.md` → "A `Measured:` trailer").
  A ratio inside the band is not claimed.
- `Measured:` trailer in the commit with the figures and their band.
- A note in `docs/BENCHMARKS.md` beside the json-writer-bytes note (its own
  `<!-- … -->` markers), written the way that note is written. Update the
  generated serialize table only through its tooling, if it has any.
