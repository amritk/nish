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
| what went wrong | [`SqliteError`](#errors) |

The reference is
[SQLite: `nish/sqlite`](../../LANGUAGE.md#sqlite-nishsqlite).

## Opening a database

`openDatabase(path, flags)` opens the database at `path`. `flags` is
`OPEN_READONLY`, `OPEN_READWRITE`, or `OPEN_READWRITE | OPEN_CREATE` to make
the file when it is missing. The path `:memory:` is a database of its own that
lives as long as the connection. `close()` closes it.

```ts nish:ok
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

```ts nish:ok
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

```ts nish:ok
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
`openDatabase` that holds a NUL byte stops the program with the
[`ffi-nul` panic](../../LANGUAGE.md#panic-sites) rather than cutting the SQL
short; bind text with NUL bytes in it through `bindTextBytes`.

```ts nish:ok
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

Check `step()`'s `Result` inside the loop, as the examples here do, rather
than assigning it to a variable declared outside: a `Result` made in one pass
of a loop does not yet survive the loop
([#899](https://github.com/amritk/nish/issues/899)).

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
and says how much room the column needs. `columnInto` with `at` outside
`0..buf.length` answers `Err(SQLITE_MISUSE)`, and a column index past the
last answers `Err(SQLITE_RANGE)`; the other reads answer 0, `SQLITE_NULL` or
`null` for a column that is not there. With no current row, before the first
`step` or after the last, every read answers as for `NULL`: `columnInto`
answers `Ok(0)`.

```ts nish:ok
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

```ts nish:ok
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

```ts nish:ok
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
against the same SQLite with the same options:

| Workload | Through `nish/sqlite` | Through C | Difference |
| --- | --- | --- | --- |
| Look up one post by id | 4,982 ns | 4,925 ns | within the noise |
| Read the 20 newest posts | 15,276 ns | 14,399 ns | +877 ns (6 %) |
| Insert a post, autocommit | 14,301 ns | 14,280 ns | within the noise |
| Insert a post, in a transaction | 4,240 ns | 4,325 ns | within the noise |

The figures are medians per call, on a four-core Xeon virtual machine.

- **A column read costs about 9 ns more than in C.** The module checks the
  statement's handle and asks whether a row is current, and `columnInto` asks
  the column's type. That difference shows only when a call reads many
  columns: reading the 20 newest posts reads 100.
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
