# SQLite's unix-excl VFS under `nish/sqlite`

`nish/sqlite` opens a file database on SQLite's default `unix` VFS. In WAL
mode that VFS keeps the log's index (the wal-index) in a `-shm` file that every
process sharing the database maps, and it takes and drops a POSIX record lock
(`fcntl`) around each transaction so those processes can see each other.
SQLite's `unix-excl` VFS is the same code with one difference: it takes its
lock once and holds it until the last connection to the file closes. The
wal-index then lives in heap memory and no `-shm` file is made.

This note records what `unix-excl` does when it is reached through
`openDatabase`, what it costs and saves, and the decision.

**Decision: offer it as an opt-in, through the route `openDatabase` already
has; do not make it the default and add no flag.** A program that owns its
database file alone can open it as `file:<path>?vfs=unix-excl` with
`OPEN_URI`. A program whose file another process reads keeps the default.

## The route

`openDatabase(name, flags)` passes `flags` to `sqlite3_open_v2` with only
`SQLITE_OPEN_EXRESCODE` added (`nishsqlite_open` in
`runtime/sqlite/nish-sqlite.c`). With `OPEN_URI` in `flags`, SQLite reads
`name` as a URI, and its `vfs=` parameter picks the VFS:

```ts
const db = openDatabase("file:app.db?vfs=unix-excl", OPEN_READWRITE | OPEN_CREATE | OPEN_URI);
```

Nothing in `std/sqlite.ts` or the adapter changes. A path with `?` or `#` in
it is percent-encoded in the URI (`%3F`, `%23`), as `bench/sqlite/run.mjs`
does. A VFS name SQLite does not know fails the open with `SQLITE_ERROR` and
"no such vfs: <name>" (`tests/link/std_sqlite_vfs_wasi`).

A new open flag was considered and not added: it would name the same thing the
URI names, and the URI also reaches the other VFSes SQLite is built with.

## What it does

Each fact is pinned by a test; the test names are the `tests/run.js` checks.

| Fact | Test |
| --- | --- |
| In WAL mode no `-shm` file is made; the `-wal` file is. The default VFS on the same file makes both. | `link/std_sqlite_excl: exits with 0 and stdout matches expected.out` |
| A second process that opens the file (on the default VFS) and reads is refused with `SQLITE_BUSY` while the first holds it open. On the default VFS the same read succeeds. | the same check; the child's answer is its exit status |
| A second connection in the same process, on the same URI, reads the first one's rows, runs `PRAGMA wal_checkpoint(TRUNCATE)` (the `-wal` file is then 0 bytes) and closes; the first connection then writes again. | `link/std_sqlite_excl_second: exits with 0 and stdout matches expected.out` |
| A `nish:threads` task cannot be that second connection: `spawn` refuses a task that calls `nish/sqlite`, whatever the VFS. | ``link/std_sqlite_excl_thread: rejected with "main.ts:24:5: error: `checkpointer` writes memory its caller can see through `openDatabase`, and `spawn` runs it beside the scope's other tasks"`` |
| Under `--profile wasi`, `?vfs=unix-excl` opens, but `PRAGMA journal_mode=WAL` and the first write answer `SQLITE_IOERR_LOCK` (3850): wasi-libc has no record locks. Natively both answer 0. | ``link/std_sqlite_vfs_wasi: on `--profile wasi` `?vfs=unix-excl` opens and its first lock answers SQLITE_IOERR_LOCK (expected.wasi.out)`` and `link/std_sqlite_vfs_wasi: exits with 0 and stdout matches expected.out` |

The lock is the process's, not the connection's, which is why a same-process
second connection is let in and a second process is not.

### The checkpointer

A WAL database needs something to checkpoint the log back into the main file.
On the default VFS that can be another process. Under `unix-excl` it cannot,
so it is one of:

- the writing connection's own automatic checkpoint (`PRAGMA
  wal_autocheckpoint`, 1000 pages by default), which runs at the commit that
  crosses it; or
- a second connection opened on the same thread, on the same URI, that runs
  `PRAGMA wal_checkpoint(...)` when the program chooses
  (`tests/link/std_sqlite_excl_second`).

It cannot be a `nish:threads` task. The compiler counts every C call as a
write the task's caller can see, so `spawn` refuses a task that opens a
connection (`tests/link/std_sqlite_excl_thread`). That refusal is not about
the VFS: it holds on the default VFS too.

### Capabilities and the sandbox

`--capabilities` cannot see the VFS: the name is a runtime string handed to
C, so a program reports the same grants on either VFS (`ffi`, plus whatever
else it does). `std_sqlite_excl` reports `ffi, fs.read, process.spawn`, the
last two from its own child process and `-shm` checks. Under `--sandbox` with
those grants and `fs.write`, it prints its expected output on both VFSes;
under `--sandbox` alone the first open answers "unable to open database
file", which is the sandbox refusing SQLite's own `open` of the file, not the
VFS.

## What it saves

### System calls

`strace -c -f` on the bench's Nish build, opened on a copy of the bench's
database with and without `?vfs=unix-excl`, counting every system call at `n`
and `2n` calls of each workload; the table is (calls at 2n − calls at n) / n.

| Workload | n | unix | unix-excl | `fcntl` per call, unix |
| --- | --- | --- | --- | --- |
| lookup | 1000 | 5.696 | 3.697 | 2 (2026 at n, 4026 at 2n) |
| feed | 100 | 3.00 | 1.00 | 2 |
| insert | 1000 | 14.369 | 8.359 | 6 (6050 at n, 12050 at 2n) |
| insert-txn | 1000 | 1.042 | 1.043 | 0 (54 at both n) |

`unix-excl` makes one `fcntl` in all, at the open. The cursor feed
(`feed-cursor-walk`) reads inside one read transaction, so it takes its locks
once on either VFS (28 `fcntl` at both n). A read on the default VFS takes and
drops its shared lock, two `fcntl`; an autocommit insert takes six. One
transaction around many statements (insert-txn) already pays them once.

### Time

The timed run of `node bench/sqlite/run.mjs --variant unix-excl` is recorded here when it finishes.

## Why opt-in, not the default

- **It changes what other processes can do.** A database opened on
  `unix-excl` cannot be read by the `sqlite3` shell, a backup tool or a second
  copy of the program while it is open: they get `SQLITE_BUSY`. A default that
  refuses them would surprise every program that shares its file.
- **The saving is on short transactions only.** It removes the lock calls a
  transaction pays once; a read or write inside an explicit transaction, and
  the cursor feed, saves nothing.
- **It does not work on wasi.** There `?vfs=unix-excl` opens and then answers
  `SQLITE_IOERR_LOCK` at the first lock, so a default would break every WAL
  database a `--profile wasi` program opens.

No flag was added, so there is no new flag for wasi to refuse; a wasi program
that names the VFS gets the I/O error above at its first statement that locks.

## Tests

- `tests/link/std_sqlite_excl`: no `-shm`, a second process refused with
  `SQLITE_BUSY`, the default VFS as control.
- `tests/link/std_sqlite_excl_second`: the same-thread checkpointer.
- `tests/link/std_sqlite_excl_thread`: a `nish:threads` checkpointer, refused.
- `tests/link/std_sqlite_vfs_wasi`: the native answers, a VFS SQLite does not
  know, and the wasi answers (`expected.wasi.out`, run by the `wasi` section).
- `node bench/sqlite/run.mjs --variant unix-excl`: the timing above.
