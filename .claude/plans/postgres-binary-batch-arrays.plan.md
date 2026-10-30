---
name: Binary results for PgBatcher and int arrays
overview: Let PgBatcher open its binds in binary, and decode one-dimensional int2, int4 and int8 array result columns in place, so a batched read stops paying timestamptz_out, int8out and array_out on the server.
stages:
  - id: batch-binary
    title: PgBatcher binary results
    goal: A PgBatcher configured with binary true reads its rows in binary, routed by the binary routing ordinal, with the text path unchanged.
    verification: node tests/run.js std_postgres_batch and node tests/postgres/live/run.mjs binary batch pass, with the text batch expected output unchanged.
    todos:
      - id: batch-config-binary
        content: Add PgBatchConfig.binary (false by default) and store it on PgBatcher — see Stage 1 PgBatcher
        status: pending
      - id: batch-take-binary
        content: Make PgBatcher.take open its bind with bindStartBinary when binary is set — see Stage 1 PgBatcher
        status: pending
      - id: batch-row-ordinal-binary
        content: Read the routing ordinal with binaryInt in binary mode, saving and restoring binary.failed — see Stage 1 PgBatcher
        status: pending
      - id: batch-live-binary
        content: Add a binary batch with a timestamptz column and the routing ordinal to the live binary scenario — see Stage 1 Tests
        status: pending
      - id: batch-link-binary
        content: Add link tests for a binary batch bind and its ordinal read — see Stage 1 Tests
        status: pending
      - id: batch-docs
        content: Update the guide, std/README.md row, docs/AI.md and the security record for the batcher — see Stage 1 Docs
        status: pending
  - id: binary-int-arrays
    title: Binary int2 int4 int8 arrays
    goal: A PgBinaryArray walker reads one-dimensional int2, int4 and int8 binary array columns in place, and sets binary.failed on anything else.
    verification: node tests/run.js std_postgres passes with the new array cases, and the live binary scenario reads int4 and int8 arrays in binary and text alike.
    todos:
      - id: array-walker
        content: Add PgBinaryArray walking the binary array layout in place — see Stage 2 PgBinaryArray
        status: pending
      - id: array-link-tests
        content: Add link tests for empty, one, many, NULL and malformed arrays — see Stage 2 Tests
        status: pending
      - id: array-live
        content: Add int4 and int8 array columns to the live binary scenario — see Stage 2 Tests
        status: pending
      - id: array-docs
        content: Update the guide Binary results section, the unsupported list, std/README.md and the security record — see Stage 2 Docs
        status: pending
---

# Binary results for PgBatcher and int arrays

## Context

[`std/net/postgres.ts`](../../std/net/postgres.ts) opens every `PgBatcher` bind with `bindStart` (`take`, around line 3167), so the batch's rows always come in text. Its routing ordinal, the last column, is read with `conn.int`, which is the text decoder. Binary results exist only for a program's own binds (`bindStartBinary`, line 1943). `int2[]`, `int4[]` and `int8[]` columns have no binary decoder, so `ARRAY(SELECT ...)` and `array_agg(...)` must be cast to text.

Both stages change [`std/net/postgres.ts`](../../std/net/postgres.ts), so they run in sequence. Stage 2 merges after Stage 1.

## Approach

- The batcher's binary flag is per config, not per call: one statement shape has one result format. `bindEnd` already writes the format code for a binary bind, so `take` only chooses `bindStartBinary`.
- Ordinal reads save and restore `binary.failed` where they save and restore `text.failed` today, so the caller's own decode state is untouched.
- The array walker reads the binary layout (`ndim`, `hasnull`, element OID, one dimension and its lower bound, then length-prefixed elements). It mirrors `PgArrayWalker`'s `begin`, `next` and return codes, reuses `PG_ARRAY_*`, and needs no allocation beyond its constructor.
- It accepts `ndim` 0 (an empty array) or 1 only. It accepts element OIDs 21, 23 and 20 only, and each element's length must equal its OID's size or the element is refused.

## Stage 1 PgBatcher

Owns: `std/net/postgres.ts`, `tests/link/std_postgres_batch/**`, `tests/postgres/live/live.ts`, `tests/postgres/live/expected/binary.out`, `docs/guide/using-nish/postgres.md`, `docs/security/postgres.md`, `std/README.md`, `docs/AI.md`, `tests/self/goldens/checked/**`.

| Change | Where |
| --- | --- |
| `binary: boolean = false` on `PgBatchConfig`, documented as the result format of every row | `PgBatchConfig` |
| `PgBatcher` keeps `binary`; `take` calls `bindStartBinary` when it is set | `take`, around line 3167 |
| `row` reads the ordinal with `conn.binaryInt(last)` in binary mode, saving and restoring `conn.binary.failed` | `row`, around line 3290 |

The text path is byte-identical with `binary` false. The doc comment on `PgBatcher` says that a batch in binary hands its caller rows that must be read with the binary decoders.

## Stage 1 Tests

- Link test: a binary `take` writes a Bind with result format code 1, and `row` reads an ordinal from a binary int8 column.
- Live `binary` scenario: a `PgBatcher` with `binary` true over a statement that returns a `timestamptz` and the routing ordinal. Its output matches the same batch in text.

## Stage 1 Docs

- `docs/guide/using-nish/postgres.md`: a batcher paragraph under "Binary results".
- `std/README.md` row for `net/postgres.ts`, which names `PgBatcher` text routing.
- `docs/AI.md` near line 2640.
- `docs/security/postgres.md`: scope and the binary batcher's ordinal read.

## Stage 2 PgBinaryArray

Owns: `std/net/postgres.ts`, `tests/link/std_postgres/main.ts`, `tests/link/std_postgres/expected.out`, `tests/postgres/live/live.ts`, `tests/postgres/live/expected/binary.out`, `docs/guide/using-nish/postgres.md`, `docs/security/postgres.md`, `std/README.md`, `tests/self/goldens/checked/**`.

```ts
export class PgBinaryArray {
  count: i32            // elements, from the header; 0 for an empty array
  elementOid: i32       // 20, 21 or 23
  start: i32            // current element's first byte
  length: i32           // current element's length
  constructor(binary: PgBinary)
  begin(b: u8[], start: i32, length: i32): void
  next(): i32           // PG_ARRAY_ELEMENT, PG_ARRAY_NULL, PG_ARRAY_END or PG_ARRAY_BAD
  int(): i64            // the current element, through PgBinary.int
}
```

- `begin` reads `ndim`, `hasnull`, the element OID, and for `ndim` 1 the dimension length and lower bound. A bad header sets `binary.failed` and every `next` answers `PG_ARRAY_BAD`.
- `next` checks each element's length prefix. A NULL needs `hasnull` 1, and a length must match the OID's size. `PG_ARRAY_END` is answered only when the walk has consumed the array exactly.
- `binary.failed` is set on every refusal, and nothing is read outside the buffer.

## Stage 2 Tests

- Link tests with hand-built bytes: `{}` (ndim 0), one element, 1000 elements, a NULL element, and malformed input (ndim 2, OID 25, a 3-byte int4 element, a truncated buffer, trailing bytes). Each malformed case sets `binary.failed`.
- Live `binary` scenario: int4 and int8 array columns, each empty, one element and many, read in binary and text alike.

## Stage 2 Docs

- Guide "Binary results": int arrays are read with `PgBinaryArray`, and ndim above 1 is refused.
- Unsupported list at the end of the guide: drop int2, int4 and int8 arrays, keep text arrays in binary, multi-dimensional arrays and a mix of text and binary columns.
- `std/README.md` and `docs/security/postgres.md`, with the walker in scope and any finding recorded with a before and after test.

## Out of scope

- Binary `text[]`, `numeric`, multi-dimensional arrays, and parameters in binary.
- Any change to `src/`, which means no `wasi` or `performance` runs.
- Any change to the text decoders or their output.

## Acceptance criteria

1. `PgBatchConfig.binary` exists and defaults to false. With it false, the batcher's Bind and rows are byte-identical to today, and every existing batch test passes unchanged.
2. With `binary` true, a batch's Bind carries result format code 1, and its routing ordinal and `timestamptz` column decode to the values the text run shows.
3. `PgBinaryArray` reads int2, int4 and int8 one-dimensional arrays that are empty, one element, many, or hold a NULL, and gives the same values as the text run.
4. Malformed binary arrays (ndim above 1, another element type, a wrong element length, truncation, trailing bytes) set `binary.failed` and never read outside the buffer.
5. The guide's Binary results section and its unsupported list match the code, and `std/README.md`, `docs/AI.md` and `docs/security/postgres.md` agree with it.
6. `npm run check`, `npm run lint`, `node tests/run.js std_postgres`, `node tests/run.js std_postgres_batch` and `node tests/postgres/live/run.mjs binary batch` all pass, and the goldens are regenerated and read.

## Verification

```bash
npm run check
npm run lint
node tests/run.js std_postgres
node tests/run.js std_postgres_batch
PG_BIN=/usr/lib/postgresql/16/bin node tests/postgres/live/run.mjs binary batch
node tests/self/goldens.js --update
```
