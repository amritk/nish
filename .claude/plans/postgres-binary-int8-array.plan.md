---
name: Binary int8[] parameters for PostgreSQL binds
overview: Add paramIntArrayBinary, which writes an int8[] in PostgreSQL binary array layout, and make Bind's parameter format codes per parameter so text parameters stay format 0.
stages:
  - id: binary-int8-array
    title: Binary int8[] parameter and per-parameter Bind format codes
    goal: A bind can send int8[] parameters in binary with its other parameters in text, with no allocation and the same maxOutput refusal as the text arrays.
    verification: node tests/run.js std_postgres, the live arrays scenario and binary scenario pass against PostgreSQL 18, and npm run check and npm run lint exit 0.
    todos:
      - id: format-codes
        content: Write per-parameter Bind format codes in bindEnd by shifting the parameters, reserving room on the first binary parameter — see Format codes
      - id: param-int-array-binary
        content: Add paramIntArrayBinary(values, start, count) writing the binary array layout — see Binary layout
      - id: link-tests
        content: Add link tests for empty, one element, int64 extremes, a mixed text and binary Bind, and refusal for room — see Tests
      - id: live-tests
        content: Add live scenario cases for the binary int8[] parameter against PostgreSQL 18 — see Tests
      - id: docs
        content: Document paramIntArrayBinary and the format codes in docs/guide/using-nish/postgres.md and update docs/security/postgres.md — see Documentation
      - id: goldens
        content: Regenerate tests/self/goldens/checked with node tests/self/goldens.js --update and read the diff — see Verification
---

## Context

Bind's parameter format-code list is written as a zero count when `openBind` runs ([std/net/postgres.ts](../../std/net/postgres.ts) near line 1958), so every parameter is text. `paramIntArray` builds a `{1,2,3}` literal that the server parses with `array_in`, which costs per element. Batched reads send one or more int8[] of hundreds of ids per statement.

## Approach

PostgreSQL requires the format-code list before the parameters, and the number of parameters is not known at `bindStart`. Options considered:

- **Chosen: shift at bindEnd.** Parameters are written as now. When the first binary parameter opens, room for the codes is reserved (two bytes per parameter written so far plus two). `bindEnd` writes the count and the codes, memmoves the parameter bytes right by that amount, and writes the codes in front of them. Only binds with a binary parameter pay the move. No allocation; text binds are byte-identical to today.
- Rejected: an API that takes the parameter count at `bindStart`. It changes every caller and fails for dynamic batches.

## Format codes

Bind layout after the change, when `binary` parameters are present:

```
count (i16)  format[0..count)  (i16 each: 0 text, 1 binary)  parameters...
```

When no binary parameter is present the list stays a single zero count, so existing bytes do not change.

## Binary layout

For `count > 0` the value is `ndim=1`, `hasnull=0`, `elemtype=20` (int8), then the dimension `(count, lower bound 1)`, then per element an `int32` length of 8 and the value as big-endian `int64`. An empty array is `ndim=0`, `hasnull=0`, `elemtype=20`. Total size is `20 + 12*count` bytes, or 12 when empty. The size is exact, so a refusal writes nothing, as `paramIntArray` does.

## Out of scope

- Binary forms of other array types, text arrays, or result decoding.
- Changing `paramIntArray`.

## Tests

- `tests/link/std_postgres_binary_*`: empty, one element, `i64` min and max, a Bind mixing text and binary parameters, and refusal for room with nothing written.
- `tests/postgres/live/live.ts` with `expected/`: the same cases against a real server, plus a server-side check that the parameter received equals the input.

## Documentation

- [docs/guide/using-nish/postgres.md](../../docs/guide/using-nish/postgres.md): `paramIntArrayBinary`, when to prefer it, and the text-by-default rule.
- [docs/security/postgres.md](../../docs/security/postgres.md): record the new code path and its scope.

## Verification

- `npm run check`
- `npm run lint`
- `node tests/run.js std_postgres`
- `node tests/postgres/live/run.mjs arrays binary` against PostgreSQL 18
- `node tests/self/goldens.js --update`, then read the diff
