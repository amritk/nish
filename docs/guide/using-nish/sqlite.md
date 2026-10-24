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
`NULL`.

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

## Threads, capabilities and where it runs

- **A connection belongs to the thread that opened it.** Its statements do too.
  Open one connection per thread that needs the database.
- **It uses `ffi`.** The module calls SQLite's C code, so `--capabilities`
  reports a program that imports it with `ffi`, and `--deny ffi` refuses it. The files
  SQLite opens are opened by C, so the `fs.read` and `fs.write` capabilities
  do not see them.
- **It runs natively, in a `--profile napi` addon and under `--profile
  wasi`**, but not as TypeScript run by Node or under the `wasm` profile.
- **Build settings** — the SQLite version, the compile-time options and how to
  add your own — are in
  [SQLite is linked when your program calls it](cli.md#sqlite-is-linked-when-your-program-calls-it).
