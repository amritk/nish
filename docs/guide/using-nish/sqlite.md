# SQLite

`nish/sqlite` gives a program a [SQLite](https://sqlite.org/) database, in a
file or in memory. SQLite itself is compiled into the program, so there is no
library to install, and a program that does not import the module carries none
of it.

| You need | Reach for |
| --- | --- |
| a connection | [`openDatabase`](#opening-a-database) |
| SQL that returns no rows | [`exec`](#running-sql-exec) |
| one statement run many times | [`prepare`, then bind, `step` and `reset`](#prepare-once-run-many-times) |
| the rows a query returns | [`step` and the `column*` calls](#reading-rows) |
| several changes that land together | [`begin`, `commit`, `rollback`](#transactions) |
| hot reads of a table or index without SQL | [`beginRead`, `openCursor`](#reading-through-a-cursor) |
| what went wrong | [`SqliteError`](#errors) |

The reference is
[SQLite: `nish/sqlite`](../../reference/language/declarations.md#sqlite-nishsqlite).

## Opening a database

`openDatabase(path, flags)` opens the database at `path`. `flags` is
`OPEN_READONLY`, `OPEN_READWRITE`, or `OPEN_READWRITE | OPEN_CREATE` to make
the file when it is missing. The path `:memory:` is a database of its own that
lives as long as the connection. `close()` closes it.

The examples on this page build with
[`--allow-panics`](cli.md#asking-what-a-program-can-do): they unwrap each
`Result` with `expect`, which stops the program on an error, and `nish/sqlite`
keeps panic sites no proof removes yet. Test `r.isErr()` before reading
`r.value` instead of calling `expect`, and the rest builds under the default
once the standard library is made panic-free.

<!-- allow-panics: unwraps a `Result` with `expect`; calls `std/sqlite.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import { OPEN_CREATE, OPEN_READWRITE, openDatabase } from "nish/sqlite";

export const main = (): i32 => {
  const db = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE).expect("open");
  db.close().expect("close");
  return 0;
};
```

Settings are SQL. A file database that many readers share usually wants
SQLite's write-ahead log, which `PRAGMA journal_mode=WAL` turns on and which
the file keeps; `PRAGMA synchronous=NORMAL` is the usual setting beside it.

<!-- allow-panics: unwraps a `Result` with `expect`; calls `std/sqlite.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import { OPEN_CREATE, OPEN_READWRITE, openDatabase } from "nish/sqlite";

export const main = (): i32 => {
  const db = openDatabase("app.db", OPEN_READWRITE | OPEN_CREATE).expect("open");
  db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL").expect("pragmas");
  db.close().expect("close");
  return 0;
};
```

## Running SQL: `exec`

`exec(sql)` runs every statement in `sql` in turn and discards any rows. It is
for schema changes, settings and one-off writes. `changes()` answers how many
rows the last `INSERT`, `UPDATE` or `DELETE` changed, and `lastInsertRowid()`
the rowid of the last row an `INSERT` made.

<!-- allow-panics: unwraps a `Result` with `expect`; calls `std/sqlite.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import { OPEN_CREATE, OPEN_READWRITE, openDatabase } from "nish/sqlite";

export const main = (): i32 => {
  const db = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE).expect("open");
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)").expect("create");
  db.exec("INSERT INTO t (name) VALUES ('ada'), ('grace')").expect("insert");
  console.log(`${db.changes()} rows, last id ${db.lastInsertRowid()}`);
  db.close().expect("close");
  return 0;
};
```

## Prepare once, run many times

`prepare(sql)` compiles one statement into a `Statement`. Bind its
parameters, `step()` it, and `reset()` it to run it again: the statement is
compiled once however many times it runs. Parameters count from 1 (`?1`, or
the order of the `?`s), as in SQLite.

| Bind | Value |
| --- | --- |
| `bindI64(i, v)` | an integer |
| `bindF64(i, v)` | a floating-point number |
| `bindText(i, s)` | a string |
| `bindTextBytes(i, buf, off, len)` | `len` bytes of a `u8[]` from `off`, as text |
| `bindBlob(i, buf, off, len)` | the same bytes, as a blob |
| `bindNull(i)` | SQL `NULL` |

SQLite copies what it is given, so the string or array can change after the
call. `reset()` keeps the bindings; `clearBindings()` sets them all back to
`NULL`. A parameter index the statement does not have (they count from 1) answers
`SQLITE_RANGE`; an `off` and `len` that do not fit inside `buf` answer
`SQLITE_MISUSE`. A `string` passed to `bindText`, `exec`, `prepare` or
`openDatabase` that holds a NUL byte is a check the module keeps at run time,
one reason a call to it needs `--allow-panics` for now; there it stops the
program with the
[`ffi-nul` panic](../../reference/language/semantics-decisions.md#panic-sites) rather than cutting the SQL
short; bind text with NUL bytes in it through `bindTextBytes`.

<!-- allow-panics: unwraps a `Result` with `expect`; calls `std/sqlite.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import { OPEN_CREATE, OPEN_READWRITE, openDatabase } from "nish/sqlite";

export const main = (): i32 => {
  const db = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE).expect("open");
  db.exec("CREATE TABLE squares (n INTEGER, sq INTEGER)").expect("create");
  const insert = db.prepare("INSERT INTO squares VALUES (?1, ?2)").expect("prepare");
  for (let n = 1; n <= 1000; n++) {
    insert.bindI64(1, toI64(n)).expect("bind n");
    insert.bindI64(2, toI64(n * n)).expect("bind sq");
    insert.step().expect("insert");
    insert.reset().expect("reset");
  }
  insert.finalize().expect("finalize");
  db.close().expect("close");
  return 0;
};
```

`finalize()` frees a statement you are done with. `close()` finalizes every
statement the connection still has, so a statement never outlives its
database; a statement or connection used after it is freed answers
`SQLITE_MISUSE` instead of crashing.

## Reading rows

`step()` answers `true` when a row is ready to read and `false` when the
statement has finished. Columns count from 0.

| Read | Answers |
| --- | --- |
| `columnCount()` | the number of columns in a row |
| `columnType(c)` | `SQLITE_INTEGER`, `SQLITE_FLOAT`, `SQLITE_TEXT`, `SQLITE_BLOB` or `SQLITE_NULL` |
| `columnI64(c)` | the column as an integer, 0 for `NULL` |
| `columnF64(c)` | the column as a floating-point number, 0 for `NULL` |
| `columnText(c)` | the column as a new string, `null` for `NULL`; it stops at a NUL byte |
| `columnBytes(c)` | the length `columnInto` would copy |
| `columnInto(c, buf, at)` | the column copied into `buf` at `at`, answering its length |

Reading a row allocates nothing unless you ask for a string. `columnText` makes
a new string each time; `columnInto` copies the bytes into an array you own,
so a loop over many rows can reuse one buffer. It copies only when the whole
column fits: an answer larger than `buf.length - at` means nothing was written,
and says how much room the column needs.

`columnInto` with `at` outside `0..buf.length` answers `Err(SQLITE_MISUSE)`,
and a column index past the last answers `Err(SQLITE_RANGE)`; the other reads
answer 0, `SQLITE_NULL` or `null` for a column that is not there. With no
current row, before the first `step` or after the last, every read answers as
for `NULL`: `columnInto` answers `Ok(0)`.

<!-- allow-panics: unwraps a `Result` with `expect`; slices with bounds it does not test; calls `std/sqlite.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import { OPEN_CREATE, OPEN_READWRITE, openDatabase } from "nish/sqlite";

export const main = (): i32 => {
  const db = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE).expect("open");
  db.exec("CREATE TABLE t (id INTEGER, name TEXT); INSERT INTO t VALUES (1, 'ada'), (2, 'grace')").expect("setup");
  const rows = db.prepare("SELECT id, name FROM t ORDER BY id").expect("prepare");
  const buf = new Array<u8>(64);
  while (rows.step().expect("step")) {
    const n = rows.columnInto(1, buf, 0).expect("name");
    console.log(`${rows.columnI64(0)} ${String.fromBytes(buf, 0, n)}`);
  }
  db.close().expect("close");
  return 0;
};
```

## Transactions

`begin()`, `commit()` and `rollback()` run `BEGIN`, `COMMIT` and `ROLLBACK`.
Many inserts inside one transaction are written to the file once, at the
commit, rather than once each.

<!-- allow-panics: unwraps a `Result` with `expect`; calls `std/sqlite.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import { OPEN_CREATE, OPEN_READWRITE, openDatabase } from "nish/sqlite";

export const main = (): i32 => {
  const db = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE).expect("open");
  db.exec("CREATE TABLE t (x INTEGER)").expect("create");
  db.begin().expect("begin");
  db.exec("INSERT INTO t VALUES (1)").expect("insert");
  db.rollback().expect("rollback");
  db.close().expect("close");
  return 0;
};
```

## Reading through a cursor

For a hot read, a `Cursor` walks one table or index directly, through
SQLite's own B-tree, without preparing or stepping a statement. A cursor
lives inside a read transaction: `beginRead()` starts one and `endRead()`
ends it, closing every cursor still open.

`openCursor(name, columns)` names the table or index and the columns you
read, comma-separated, in the order the schema has them. For a table, that is
every column. For an index, it is the key columns, each with `DESC` where the
index has it, and then `rowid`. Column `n` is the `n`th name. If the list
does not match the schema, the open fails with `SQLITE_SCHEMA`, so a
changed schema cannot be misread.

<!-- allow-panics: unwraps a `Result` with `expect`; calls `std/sqlite.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import { OPEN_CREATE, OPEN_READWRITE, SEEK_GE, openDatabase } from "nish/sqlite";

export const main = (): i32 => {
  const db = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE).expect("open");
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT); CREATE INDEX t_name ON t (name)").expect("create");
  db.exec("INSERT INTO t (name) VALUES ('ada'), ('bo'), ('cy')").expect("insert");
  db.beginRead().expect("begin");
  const ix = db.openCursor("t_name", "name,rowid").expect("cursor");
  ix.keyReset().expect("reset");
  ix.keyText("b").expect("key");
  let r = ix.seek(SEEK_GE);
  while (r.isOk() && r.value) {
    console.log(`${ix.rowid()}`);
    r = ix.next();
  }
  db.endRead().expect("end");
  db.close().expect("close");
  return 0;
};
```

- **Moves answer whether there is a row.** `first`, `last`, `next`,
  `previous`, `seekRowid` (a table) and `seek` (an index) answer `Ok(true)` on
  a row and `Ok(false)` when there is none.
- **A seek compares a key prefix.** Build it with `keyReset` and then
  `keyI64`, `keyText` or `keyTextBytes`, one per key column, in order.
  `seek(SEEK_GE)`, `SEEK_GT`, `SEEK_LE` or `SEEK_LT` then lands on the first
  entry at or past it, or the last at or before it.
  A key gets no column affinity: `keyText("5")` on an `INTEGER` column sorts
  after every number, so seek a number with `keyI64`.
- **Reads take the stored value.** `columnI64` reads an integer.
  `columnInto` copies text or blob bytes into a buffer, the way
  `Statement.columnInto` does; for a number it answers
  `Err(SQLITE_MISMATCH)`. `columnType` answers what the row stores. A row
  written before `ALTER TABLE ADD COLUMN` added the column answers
  `Err(SQLITE_SCHEMA)` there, not the column's default.
- **Anything that could change what a cursor reads closes it.** That includes
  `exec`, `commit`, `rollback`, stepping a statement that writes, and
  `endRead`. A closed cursor answers `Err(SQLITE_MISUSE)`, and `rowid` and
  `columnI64` answer 0. Plain `SELECT` statements can run beside open
  cursors, except one that reads a `pragma_*` function, which closes them.
- **A read transaction does not forbid writes.** A write inside
  `beginRead()` closes the open cursors, and `endRead()` commits it.
- **Some objects cannot be read this way.** Views, virtual tables,
  `WITHOUT ROWID` tables, generated columns, expression indexes, indexes with
  a collation other than `BINARY`, columns whose name holds a comma or ends
  in ` DESC`, and databases whose encoding is not UTF-8 are refused with
  `SQLITE_SCHEMA`.

How it works, and the rules the adapter keeps, are in
[Reading SQLite through B-tree cursors](https://github.com/amritk/nish/blob/main/docs/sqlite-cursor.md).

## Errors

Every call that can fail answers a `Result`. `openDatabase` and `prepare`
fail with a `SqliteError`; the calls a loop makes fail with SQLite's bare
result code, so a failure costs nothing until you ask about it. `error(code)`,
on the `Database` or `Statement` whose call failed, turns the code into a
`SqliteError`. Ask before the next call, which replaces the message.

A `SqliteError` has three fields:

- `extendedCode`, SQLite's extended result code, such as 2067 for
  `SQLITE_CONSTRAINT_UNIQUE`;
- `code`, the primary code, such as `SQLITE_CONSTRAINT`: the low byte of the
  extended one;
- `message`, SQLite's own text, such as `UNIQUE constraint failed: t.id`.

<!-- allow-panics: unwraps a `Result` with `expect`; calls `std/sqlite.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import { OPEN_CREATE, OPEN_READWRITE, SQLITE_CONSTRAINT, openDatabase } from "nish/sqlite";

export const main = (): i32 => {
  const db = openDatabase(":memory:", OPEN_READWRITE | OPEN_CREATE).expect("open");
  db.exec("CREATE TABLE t (id INTEGER PRIMARY KEY)").expect("create");
  const insert = db.prepare("INSERT INTO t VALUES (?1)").expect("prepare");
  insert.bindI64(1, toI64(7)).expect("bind");
  insert.step().expect("first");
  insert.reset().expect("reset");
  const again = insert.step();
  if (again.isErr()) {
    const e = insert.error(again.error);
    console.log(`${e.code === SQLITE_CONSTRAINT} ${e.message}`);
  }
  db.close().expect("close");
  return 0;
};
```

Some answers are not errors, or not the error you might expect:

- **A read with no current row is not an error.** Before the first `step`, or
  after `step` answers `false`, `columnInto` answers `Ok(0)` and writes
  nothing, and the other reads answer 0, `SQLITE_NULL` or `null`, as for a
  `NULL` column. Only a column index the statement does not have is
  `Err(SQLITE_RANGE)`.
- **Too many open handles is "out of memory".** A thread holds at most 65,535
  open connections and 65,535 open statements, and a slot reused 32,767 times
  is retired, which takes some two billion opens or prepares. When no slot is left, `openDatabase` and `prepare` fail with
  `SQLITE_NOMEM` and the message `out of memory`. Close and finalize what you
  are done with.

## What it costs

A call through `nish/sqlite` costs about what the same call to SQLite's C API
costs. `bench/sqlite/` measures the challenge schema's queries both ways,
against the same SQLite with the same options. Each workload is judged by its
median per call: a difference is reported only when it is larger than the gap
between two byte-identical copies of the same Nish binary and than the spread
of either side's own runs. Otherwise it is "not measurable".

| Workload | Through `nish/sqlite` | Through C | Difference |
| --- | --- | --- | --- |
| Look up one post by id | 5,117 ns | 4,957 ns | not measurable |
| Read the 20 newest posts | 15,391 ns | 14,800 ns | +591 ns (4 %); +266 to +877 ns across three measurements |
| Insert a post, autocommit | 14,213 ns | 14,078 ns | not measurable (commit cost dominates) |
| Insert a post, in a transaction | 4,196 ns | 4,294 ns | not measurable |

The figures are medians per call, on four cores. The difference includes the
module's own checks.

- **Reading many columns is where the module shows.** Reading the 20 newest
  posts reads 100 columns, steps 21 times and resets once, and costs under
  1 µs more than in C. Across three measurements the difference ranged from
  about 2 to 6 % of the call. Which part of the call carries it, the column
  reads, the steps or the reset, is not measured.
- **An autocommit insert's cost is mostly the commit.** Its runs vary by more
  than the module could add; in a transaction the difference is not
  measurable.
- **SQLite's own work dominates everything else**: the B-tree search, the
  join and the commit.
- **The protocol and the full figures are in
  [bench/README.md](https://github.com/amritk/nish/blob/main/bench/README.md#sqlite).**

## Threads, capabilities and where it runs

- **A connection belongs to the thread that opened it.** Its statements do too:
  the handles live in tables kept per thread, so a handle passed to another
  thread names nothing there. Open one connection per thread that needs the
  database, and close it before the thread ends: a thread's open connections
  are not closed when it exits, and stay allocated.
- **It uses `ffi`.** The module calls SQLite's C code, so `--capabilities`
  reports a program that imports it with `ffi`, and `--deny ffi` refuses it. The files
  SQLite opens are opened by C, so the `fs.read` and `fs.write` capabilities
  do not see them.
- **It runs natively and under `--profile wasi`.**
- **Build settings** — the SQLite version, the compile-time options and how to
  add your own — are in
  [SQLite is linked when your program calls it](cli.md#sqlite-is-linked-when-your-program-calls-it).
