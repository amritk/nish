# pg-decode: Postgres DataRow decode and Bind encode, with no server

`main.ts` builds canned backend bytes once, starts a `PgConnection` on them
itself (startup, SCRAM nonce and all, with no socket), and then times three
kernels. Each one folds every byte written and every value read into a
checksum:

| kernel | what one operation is |
| --- | --- |
| `rows <n>` | a binary-format group on one `PgConnection`: Bind (one `int8` by `paramInt`), Execute and Sync written and drained; then BindComplete, RowDescription, `<n>` DataRows, CommandComplete and ReadyForQuery fed through `receive`/`next` (`readRow`), with every column read |
| `pool <n>` | the same group through a one-slot `PgPool`: `request`, `dispatch`, bind, send, and `PgPool.next` for every event |
| `params <n>` | a text-format Bind as `PgBatcher`'s `PG_BATCH_TEXT` writes one: an array of `<n>` text keys of 8 to 64 bytes (`arrayElement`), an `int8[]` of `<n>` ids (`paramIntArray`, so `putDecimal`) and one `int8`, then Execute and Sync |

A row is an `int8` id, a text of 8 to 64 bytes, a `timestamptz`, an `int8[]`
of 0, 1, 4 or 8 elements, and a text that is NULL on two rows in three. The
`int8` and the `timestamptz` are read by `binaryInt`, so through `getI64BE`;
the array is read by `PgBinaryArray`.

```bash
npm run build
node bench/pg-decode/run.mjs --validate            # every checksum, no timing
node bench/pg-decode/run.mjs --base origin/main    # ns/op against main's std/
node bench/pg-decode/run.mjs --callgrind --base origin/main
node bench/pg-decode/run.mjs --cpu x86-64-v3 --case rows
```

`run.mjs` builds `main.ts` with `--profile speed` into
`build/bench/pg-decode/`, plus a byte-identical copy. The copy's distance from
the build is the noise band, and a change inside it is noise. `--base <rev>`
builds the same `main.ts` with the same compiler against `std/` as it is at
`<rev>`. `--binary [name=]<path>` adds any other build as a column. Every case
calibrates one iteration count to about 200 ms. The rounds interleave the
columns (`bench/json-compare/rounds.mjs`), at least 11 of them, and each
column's median is reported with its min-max spread. Before timing, each
column must print the case's pinned checksum; `--validate` checks only that.
`--callgrind` counts instructions an operation instead: the count at 110
iterations less the count at 10, over 100, so setup cancels. The header
stamps the CPU model, its flags and the build flags.

## Result

RESULT_PLACEHOLDER

## Where the instructions go

CANDIDATES_PLACEHOLDER

## Tried and dropped

| idea | measured | why dropped |
| --- | --- | --- |
DROPPED_PLACEHOLDER
