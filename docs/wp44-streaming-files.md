# WP44: Streaming file reads — a descriptor, a positional read, a size and a close

**Status: proposed; design only, nothing built.** This note answers
[#710](https://github.com/amritk/nish/issues/710). Today a Nish program reads a
file only whole. `readFileSync`, `readFileSyncOrNull` and `readFileBytesSync`
each return the entire file as one arena value, and refuse a file past
2^31 − 1 bytes ([LANGUAGE.md](LANGUAGE.md#file-io)). This package adds four
builtins. With them, a program reads a file a window at a time, into a `u8[]`
the program owns, and memory follows the window rather than the file. The
questions the owner settles are in §9, each marked **Owner decides**, with a
recommendation. The rest of the note follows the recommended answers. Every
recommendation is a default, not a decision.

[LANGUAGE.md](LANGUAGE.md) stays normative. Nothing here changes the language
until a stage lands with its rule. Every claim about today's compiler is
anchored at commit `c8a00d6` (`c8a00d6160781c616a877a9215958caaeb43c9fd`), on
`main` after #745.

## 1. The proposal

Four builtins, exported by `nish:fs` and global like the rest of
[File I/O](LANGUAGE.md#file-io):

| Signature | Answers |
| --- | --- |
| `fileOpen(path: string): i32` | a descriptor `>= 0` open for reading a **regular file**, or a negative errno (§3) |
| `fileReadAt(fd: i32, buf: u8[], off: i32, len: i32, pos: i64): i32` | at most `len` bytes of the file from byte `pos` into `buf[off, off + len)`. The answer is the count, `0` at or past the end of the file, or a negative errno |
| `fileSize(fd: i32): i64` | the file's size in bytes now, or a negative errno |
| `fileClose(fd: i32): i32` | `0`, or a negative errno. Either way the descriptor is gone afterwards |

The descriptor is a plain `i32`, as `nish:net`'s is (§2). The read is
positional, `pread(2)`, and there is no cursor. So one open file can serve
many connections at once, and a descriptor shared across a `fork` (WP42) has
no offset for the processes to fight over. Positions and sizes are `i64` in
both number modes, so a file past 2^31 − 1 bytes is readable. Only the window
is capped, since it is an array. No call allocates, and the caller owns every
byte that moves (§6).

What this costs: nothing checks use after close or a leaked descriptor, as
nothing does for a socket today. And `using` cannot close the descriptor
(§2, §9 Q5). The sketch below is the `/video` route of #710 on
`std/net/http1-server`, minus the event loop. The file is opened once and
read in 64 KiB windows, and `write`'s back-pressure decides when the next
window is read:

```ts
// Per connection, the state is one i64: how far into the file it has got.
// The answer is the new position, or -1 when the response cannot be finished
// and the connection is to be closed.
function pump(c: Http1Connection, file: i32, size: i64, window: u8[], at: i64): i64 {
  let pos = at
  while (pos < size) {
    const left = size - pos                         // never past Content-Length
    const want = left < 65536 ? toI32(left) : 65536
    const n = fileReadAt(file, window, 0, want, pos)
    if (n <= 0) { return -1 }                       // shrank under us, or failed
    const took = c.write(window, 0, n)
    if (took === H1_AGAIN) { return pos }           // wait for H1_WRITE, then pump again
    if (took < 0) { return -1 }                     // H1_CLOSED, H1_INVALID
    pos = pos + toI64(took)
    if (took < n) { return pos }                    // the rest of this window on the next wake
  }
  return pos
}

function main(): void {
  const video = fileOpen("public/kyuukurarin.mp4")  // once, at start-up
  if (video < 0) { panic("cannot open the video") }
  const size = fileSize(video)                      // the Content-Length
  const window = new Array<u8>(65536)               // the only buffer
  // ... the event loop: on each H1_WRITE, pos = pump(c, video, size, window, pos)
}
```

## 2. The handle's type

**A plain `i32` descriptor**, for four reasons:

1. **The server must store it.** The program keeps a streaming response open
   across many wakes of its event loop. So the file it streams from has to sit
   in per-connection state, or in a table shared by every connection, from one
   wake to the next. The only owned handle the language is building, WP40's
   handle class ([wp40-ffi-buffers-handles.md](wp40-ffi-buffers-handles.md)
   §4d), deliberately cannot do that. It is bound only by `using`. It cannot
   be returned, stored in a field or an array, or captured, and "a handle
   cannot outlive the function that opens it". That is the right rule for an
   owned C pointer. It is the wrong one for a file served across wakes.
2. **`using` takes three things today.** Those are `scope()`, a `Mutex`'s
   `lock()` and `arena()` ([LANGUAGE.md](LANGUAGE.md#scoped-tasks-using-s--scope), the `using`
   rule, `reject_thread_using_not_scope`). Only `nish/threads` may declare
   `[Symbol.dispose]` (`reject_thread_dispose_elsewhere`). A `using`-closed
   file would be a fourth disposal kind in `walkScopes` (`src/parallel.ts`)
   and in the emitter's scope stack. WP40 H1 is building that kind now, for
   `CPtr`. Building a second, narrower one first means two sets of escape rules
   for one idea.
3. **TypeScript must accept the program.** `npm run check` and the Node
   reading (§5) take the source as TypeScript. `using f = fileOpen(p)` over a
   `number` is a type error there, because a number is not `Disposable`. So a
   `using` form needs a class with `[Symbol.dispose]`, which is point 2 again.
4. **It matches what exists.** `nish:net` hands out `i32` descriptors and
   closes them with `netClose`
   ([LANGUAGE.md](LANGUAGE.md#nishnet-addresses-non-blocking-tcp-and-udp-and-the-readiness-loop)),
   and its programs already carry them in fields and arrays
   (`std/net/http1-server.ts`, `Http1Server.close`). A later `sendfile` takes
   two descriptors (§8), so an `i32` keeps that door open at no cost.

What the plain integer gives up, said plainly:

- **A file descriptor and a socket are the same type.** `fileReadAt` on a
  socket answers `-29` (`ESPIPE`) and does no harm. `fileClose` on a socket
  closes it, exactly as `netClose` would.
- **A descriptor read after `fileClose`** answers `-9` (`EBADF`). The kernel
  may also have reused the number for a newer open, in which case the read
  reads the wrong file. This is the hazard every `nish:net` program carries
  today.
- **A forgotten `fileClose`** leaks until the process exits. The cap is the
  process's `RLIMIT_NOFILE`, past which `fileOpen` answers `-24` (`EMFILE`).

An opaque `File` class on WP40's H1 can wrap these four builtins later, in
`std/`, for a program whose file lives in one block. That is §9 Q5 and is not
part of this package.

## 3. The four builtins

### `fileOpen(path: string): i32`

- **Native.** `open(path, O_RDONLY | O_CLOEXEC | O_NONBLOCK)`, then `fstat`.
  `O_CLOEXEC` keeps the descriptor out of a `spawnSync` child, as `runtime-os.c`
  already does for the whole-file read (RT-12). `O_NONBLOCK` is there only so
  that opening a FIFO with no writer cannot hang. It changes nothing for a
  regular file.
- **What it accepts.** Anything that is not a regular file (`S_ISREG`) is
  closed again and refused: a directory is `-21`, and a FIFO or a device is
  `-22`. A Unix-domain socket never gets that far, since `open(2)` on one
  fails with `ENXIO`, `-6`. So every descriptor `fileOpen` gives out has a
  size and can be read positionally. `readFileSyncOrNull` refuses
  directories too, but differs in two places. It opens without `O_NONBLOCK`,
  so it blocks on a FIFO with no writer (which is why `nish_read_file_bytes`
  is not `willreturn`). And it reads a character device such as `/dev/null`
  as empty, where `fileOpen` refuses one (§9 Q6).
- **Errno.** The answer is the negated errno, in Linux's numbering on every
  platform, as `nish:net` answers (`nish_net_err`, `runtime/runtime-net.c`).
  The documented set is:

  | Value | Meaning |
  | --- | --- |
  | `-2` | not found |
  | `-6` | a Unix-domain socket, or a device with no driver (`ENXIO`) |
  | `-13` | permission denied |
  | `-20` | a component is not a directory |
  | `-21` | a directory |
  | `-22` | not a regular file |
  | `-23`, `-24` | the system's or the process's descriptors are exhausted |
  | `-36` | name too long |
  | `-40` | too many symbolic links |
  | `-5` | any other failure, collapsed so both runtimes agree (§5) |

  A path holding a NUL is `-2`, as every builtin answers a missing path
  (`nish_cpath`, RT-3). Node throws `ERR_INVALID_ARG_VALUE` for one, which is
  not an errno name, so the shim tests for a NUL before it calls
  `fs.openSync` and answers `-2` itself (§5). A static server needs `-2` and `-13` apart, because one
  is a 404 and the other a 403. That is the case for an errno over a bare `-1`
  (§9 Q3).
- **Symbolic links** are followed, as `readFileSync` follows them. The
  writers' `O_NOFOLLOW` guards against a write landing somewhere else, and
  this builtin only reads. Refusing traversal is the static-file layer's job,
  in WP43's stage 3 ([wp43-http-app-layer.md](wp43-http-app-layer.md) §1).

### `fileReadAt(fd, buf, off, len, pos): i32`

- **Native.** `pread(fd, buf->data + off, len, pos)`, retried on `EINTR`. The
  answer is the count or the errno, mapped as above. `EBADF` is `-9`,
  `ESPIPE` is `-29` and `EIO` is `-5`. Any other errno is `-5`.
- **The window.** It is checked as `netRead`'s is. `0 <= off <= off + len <=
  buf.length` holds once all five arguments are evaluated, or the call panics
  with `slice out of range: [off, off + len) of length n`.
  `--unchecked-indexing` drops the check
  ([LANGUAGE.md](LANGUAGE.md#bounds)). A `readonly u8[]` or any other
  element type is refused, as `reject_net_readonly` and `reject_net_element`
  refuse them.
- **`pos < 0`, or `pos + len` past 2^63 − 1,** answers `-22` before the
  kernel is asked, in both runtimes. The second is what Linux answers itself
  (`EINVAL` from `rw_verify_area`), and checking it first keeps every
  platform the same. The first matters under Node: there `fs.readSync` takes
  a position of `-1` to mean "from the current offset", and so would read
  where this builtin must refuse. Any other `pos` at or past the end answers
  `0`. `len` of `0` answers `0` as well, so a loop asks for at least
  one byte, as `netRead`'s row says.
- **Short reads.** The count may be fewer than `len` before the end. POSIX
  promises a full read from a regular file only up to the end, and a signal or
  a FUSE file system may stop it early. A caller loops until it gets `0`, or
  until it has read the size it planned for.
- **The size can change.** The file may shrink or grow between `fileSize` and
  the reads. A reader that planned on `fileSize` and gets `0` early has a file
  that shrank. A server that has sent `Content-Length` must close the
  connection at that point, because it has no honest way to finish the
  response. The builtin cannot know this, and the guide page says so.

### `fileSize(fd: i32): i64`

`fstat`'s `st_size`, or a negative errno (`-9` for a bad descriptor). It is
`i64` because a size past 2^31 − 1 is the third gap #710 names. It is a
snapshot: see "The size can change" above.

### `fileClose(fd: i32): i32`

`close(2)`. It answers `0` or the negated errno, after which the descriptor is
gone all the same, as `netClose`'s row says. It is never retried on `EINTR`,
because Linux has released the number by then and a retry could close someone
else's.

### What the checker and emitter carry

- **Effect** `write` for all four, as every file and `nish:net` builtin carries
  it. Kernel state is not memory LLVM tracks, so two `fileReadAt` calls must
  never fold into one.
- **Attributes.** None of the four is `willreturn`, for the reason
  `nish_read_file_bytes` is not (`src/runtime.ts`): a file on a network or FUSE
  file system can block for as long as it likes. `buf` is `nocapture` and is
  recorded as written through `builtinArgumentLetters` (`src/emit-util.ts`),
  as `netRead`'s `w` is. So the region and attribute rules see the write.
- **Parallel code.** All four reach a capability (§4), so each is refused in a
  `scope()` task and in a parallel body by the rule that already refuses every
  labelled builtin there ([LANGUAGE.md](LANGUAGE.md#capabilities)). The
  ownership rule for descriptors across threads, which
  [wp39-http-server.md](wp39-http-server.md) §6 leaves open, stays open: no
  descriptor crosses a thread.

## 4. Capabilities (WP35, WP36, WP37)

All four are **`fs.read`**. Each takes exactly one row in `builtinCapability`
(`src/capabilities.ts`), beside `readFileBytesSync`'s, and `tests/capabilities.js`
fails the change until it has them. `fileSize` and `fileClose` are `fs.read`
too, not `CAP_NONE`. A program denied `fs.read` can hold no descriptor
`fileOpen` gave it, and an ambient `fileClose` would be the one file builtin
`--deny fs.read` did not refuse. Closing an inherited descriptor, or a socket,
is `netClose`'s job.

- **[WP35](wp35-capabilities.md)** reports them under `fs.read` with no new
  capability. No `.ll` byte moves from the label: no attribute reads a
  capability.
- **[WP36](wp36-capability-policy.md)** refuses them (NL2459) under
  `--deny fs.read`, or under an `--allow` that leaves `fs.read` out, and it
  does so per exposed function, exactly as it refuses `readFileSync` today.
  There is no new flag and no new manifest field.
- **WP37** (no note yet) is where `fs.read=<dir>` would be accepted, enforced
  by Landlock in the native `main` wrapper. This design suits that: the only
  way to a path is `fileOpen`, which is one `open(2)`, and Landlock checks at
  open time. A positional read on a descriptor already open needs no second
  check. WP36 refuses the directory scope today, and this package does not
  change that.

## 5. The TypeScript reading (class A)

Under Node, `runtime/shim.mjs` supplies the four, and `runtime/nish.mjs`
provides them, as it provides `readFileBytesSync`:

| Builtin | Node |
| --- | --- |
| `fileOpen` | `fs.openSync(path, O_RDONLY \| O_NONBLOCK)`, then `fs.fstatSync(fd).isFile()`. Refuse and close otherwise, with `-21` for `isDirectory()` and `-22` for the rest |
| `fileReadAt` | `fs.readSync(fd, scratch, 0, len, pos)`, where `pos` is the `bigint` an `i64` is under Node. Then copy `scratch[0, n)` into `buf[off, off + n)` |
| `fileSize` | `fs.fstatSync(fd, { bigint: true }).size` |
| `fileClose` | `fs.closeSync(fd)` |

**The copy.** Under Node a `u8[]` is a plain `Array`
([LANGUAGE.md](LANGUAGE.md#file-io), the `readFileBytesSync` row), so
`fs.readSync` cannot write into it directly. The shim keeps one module-level
`Buffer`, grows it to the largest `len` it has been asked for, and copies out
of it. The bytes match. Only the cost under Node differs, and the native
memory rule (§6) is not a claim about Node.

**Before Node is asked**, the shims answer what Node would answer differently:
a path with a NUL is `-2` (`fs` throws `ERR_INVALID_ARG_VALUE`), and a `pos`
that §3 refuses is `-22` (`fs.readSync` reads from the current offset at
`-1`). Each check is a few lines, and each is a planned differential case.

**Errors.** Each shim catches what Node throws and maps `err.code` through
one table onto the numbers of §3. The match is by name (`ENOENT` is `-2`), not
by `err.errno`, because libuv's numbers are the platform's and Darwin's differ
from Linux's. A code outside the table is `-5`. Collapsing to `-5` is what
makes the two runtimes agree byte for byte, since the C side collapses the
same way. The native runtime maps through the same named table (one
`nish_fs_err` beside `nish_net_err`), so Darwin's and WASI's errno numbering
both come out as Linux's.

**At the end of the file**, both runtimes answer `0`, both at and past the
end. `pread` returns 0 there, and `fs.readSync` answers `bytesRead === 0`.
`EINTR` never reaches Node code, because libuv retries it.

**What is not class A.** The *timing* of a short read can differ between the
runtimes, so a program that prints how many bytes each call answered can
print different lines. A program that loops to `0` and prints what it read
prints the same bytes. The differential case is written that way, and the
LANGUAGE.md rule states the short read as allowed. A `pos` that is not an
integer cannot arise, because `i64` has no fractions.

## 6. Memory rules

- **The caller owns every byte that moves.** None of the four allocates from
  the arena. `fileOpen` passes the string's own NUL-terminated bytes
  (`nish_cpath`), and `fileReadAt` writes only into `buf`. A loop that streams a
  4 GiB file through one 64 KiB window keeps the arena where it started, as
  `net_tcp_echo` keeps it across its messages. The test of the bar is
  `mem_file_stream_flat` (§7). This is the reverse of `readFileBytesSync`,
  which allocates the whole file as a fresh `noalias` array on every call.
- **The window is borrowed for the call and never kept.** `buf` is `nocapture`
  in the runtime's declaration. It must be a mutable `u8[]`. Inside a scope
  region it must not be an array a task can read, or the call is refused as
  `reject_net_region` refuses `netRead`'s.
- **The descriptor is not memory.** No arena rewind, block exit, `arena()`
  release or end of a function closes it. It is an integer, so it can be
  stored, returned and passed anywhere. That is §2's whole point, and it is
  also why a leak is the program's bug and not the compiler's. Process exit
  closes every descriptor. `process.exit` and a panic leak nothing that
  outlives the process.
- **No `mmap`.** It would avoid the copy into `buf`, but a file truncated under
  a mapping is `SIGBUS`, a signal the language does not handle. It has no Node
  twin either, so it is declined, not deferred.
- **Sizes.** The count is an `i32`, because a window is an array and an array
  is capped at 2^31 − 1 elements (`NISH_ARRAY_MAX`, RT-1). Positions and sizes
  are `i64`, so the whole-file builtins' 2^31 − 1 limit does not apply.

## 7. Targets

| Target | What the four do |
| --- | --- |
| native Linux, Darwin | as §3; Darwin's errno is mapped to Linux's numbers |
| `--profile wasi` | compiled and linked through `runtime-os.c` over wasi-libc, as `readFileSyncOrNull` already is when the compiler itself links into `nish.wasm` (`tests/run.js`, "web: src/ links into one wasi module") |
| `--target wasm32` (freestanding), `--profile wasm` | refused (§9 Q7) |

**WASI.** No new import is written by hand. wasi-libc lowers `open` to
`path_open` against the preopened directory that covers the path, `pread` to
`fd_pread`, `fstat` to `fd_filestat_get` and `close` to `fd_close`. The host's
preopens are therefore the capability boundary on WASI. A path outside every
preopen fails as `ENOENT` or `ENOTCAPABLE`: the first is `-2`, and the second
is collapsed to `-5` unless the owner folds it into `-13` (§9 Q7). WASI's errno
numbering differs from Linux's (its `ENOENT` is 44), so the native mapping of
§5 is required here, not only on Darwin. `web/wasi.mjs` already implements
`path_open`, `fd_pread`, `fd_filestat_get` and `fd_close` over its in-memory
file system, and `examples/wasi-host.mjs` preopens `.`. A WASI round trip is a
stage-2 check, and it sits in `tests/run.js`'s `wasi` section, which skips
without a sysroot.

**Freestanding wasm** has no libc and no file system (`runtime-wasm.c`). The
checker's existing `refuseOnWasm` (`src/builtins.ts`) is the wrong tool here,
because it fires for `--profile wasi` as well, and these four work there. The
refusal needs the target rather than the profile. Per CLAUDE.md, a guard in the
compiler never sees the `--profile wasm` link of IR compiled for the host, so
that route also needs `runtime-wasm.c` either to define the four or to fail the
link by name. §9 Q7 picks between those. Today the whole-file builtins are not
refused on freestanding wasm at all: they compile and then fail to link. The
same gap noted beside a new refusal is a separate fix, not this package's.

## 8. Not in this package

- **`sendfile`.** A zero-copy path from a file to a socket removes the copy
  through `buf`. [wp39-http-server.md](wp39-http-server.md) §6 leaves it out on purpose:
  "a runtime change that makes sense only after a profile shows the syscalls
  or the copy on top. None is ruled out." Nothing here changes that. With an `i32` descriptor it would be one more builtin later,
  something like `fileSendTo(fd, sock, pos, len): i32` under `fs.read` and
  `net`. It would be useless under TLS without kernel TLS, which WP39 defers in
  the same line.
- **A cursor read** (`read(2)` and `lseek`). A caller keeps its own `i64`
  position, and a cursor is the one design that breaks a descriptor shared by
  connections or by forked workers. Declined (§9 Q4).
- **Writing, `O_APPEND`, directories, `stat` by path.** These are other
  packages. `fileSize` answers on an open descriptor only, because a `stat` by
  path checks one file and the program then opens another (a
  time-of-check/time-of-use race).
- **Non-regular files.** Streaming from a pipe or stdin wants a cursor and
  readiness, which is `nish:net`'s model, not this one (§9 Q6).
- **The static-file layer.** MIME types, `ETag`, `Range` and traversal belong
  to WP43 stage 3 (`nish/net/static`). This package is what that layer reads
  through.

## 9. Open questions

Each is the owner's call. The note follows the recommendation until one is
made.

| # | Question | Recommendation | Decided |
| --- | --- | --- | --- |
| Q1 | **The handle's type**: a plain `i32` descriptor, or an opaque handle class? | `i32` (§2): the server must store the handle across wakes, and WP40's handle class cannot be stored | **Owner decides** |
| Q2 | **The names**: `fileOpen`, `fileReadAt`, `fileSize`, `fileClose`, or Node's `openSync`, `readSync`, `fstatSync`, `closeSync`? | the `file*` names. Node's names throw where these answer a number, so reusing them would give a global two meanings across the runtimes | **Owner decides** |
| Q3 | **Failure as a value**: the negated Linux errno over the fixed set of §3, or a bare `-1`? | the errno, as `nish:net` answers. A 404 and a 403 need `-2` and `-13` apart | **Owner decides** |
| Q4 | **Positional only**, or a cursor `fileRead` beside it? | positional only (§8) | **Owner decides** |
| Q5 | **`using`**: once WP40 H1 lands, should `std/` offer a `File` class closed by `using` over these builtins, which needs H1 to accept an `i32` field closed by a builtin? Or does that stay out? | out of this package. Reopen it after H1 ships, with a program that wants it | **Owner decides** |
| Q6 | **Regular files only**, or FIFOs, devices and stdin too? | regular files only (§3, §8). A pipe has no size and no position | **Owner decides** |
| Q7 | **Freestanding wasm**: refuse at check time on a `wasm32` target outside the wasi profile, with a `runtime-wasm.c` that defines the four as answering `-38` (`ENOSYS`) for the `--profile wasm` route? Or let that route fail at link time, as the whole-file builtins do today? And on WASI, is `ENOTCAPABLE` folded into `-13` (permission denied) or left as `-5`? It has no Linux number of its own (WASI's 76 is Linux's `ENOTUNIQ`) | refuse at check time, and answer `-38` on the freestanding route so the link never fails. `ENOTCAPABLE` stays `-5`: a path outside every preopen is a deployment bug, not a 403 | **Owner decides** |
| Q8 | **Capability of `fileSize` and `fileClose`**: `fs.read`, or `CAP_NONE`? | `fs.read` (§4) | **Owner decides** |
| Q9 | **`sendfile`**: confirm it stays deferred to WP39 §6 | deferred (§8) | **Owner decides** |

## 10. Stages, once the questions are settled

Each stage is one pull request with the usual set: a golden `.ll`, an
`llvm-as` pass, a native round trip, negative tests, a LANGUAGE.md row, an
IR_COOKBOOK entry, a `docs/guide/` page, and the CLAUDE.md pairings (the
runtime prelude regenerated by `docs/cookbook/regen.sh`, `tests/nish-cmp.js`'s
`DECLARED`, `unfrozen.txt`). `.claude/selfhost.md` "Adding a builtin" lists
the files. `src/` does not call the builtins before the seed ships them (the
rolling freeze), and nothing in this package needs it to.

1. **F1: the four builtins, native and Node.** Checker rules in
   `src/builtins.ts` and `src/nish-modules.ts` (`nish:fs`), runtime
   declarations in `src/runtime.ts`, lowering in `src/emit-builtins.ts`, the
   written-buffer letter in `src/emit-util.ts`, four `fs.read` rows in
   `src/capabilities.ts`, and the C in `runtime/runtime-os.c` with `nish_fs_err`
   and its `.text*` ceiling in `tests/runtime-budgets.js`. The Node half is in
   `runtime/shim.mjs`, `runtime/nish.mjs` and `runtime/nish.d.ts`. Planned
   tests:
   - `file_read_at`: round trip, read to `0`, bytes printed
   - `file_read_at_eof`: at and past the end
   - `file_open_errors`: missing file, directory, FIFO, socket, a path with a NUL
   - `file_read_at_pos`: a negative `pos` and a `pos + len` past 2^63 − 1, both `-22`
   - `file_size_large`: a sparse file past 2^31 bytes, which `tests/run.js`
     makes with `fs.truncateSync`, sized and read at its end
   - `file_read_at_bounds`, `file_read_at_unchecked`
   - `mem_file_stream_flat`: 10,000 windows, with the arena checked unchanged
   - `reject_file_read_readonly`, `reject_file_read_element`,
     `reject_file_fd_type`, `reject_file_read_task`
   - a differential case run under Node
2. **F2: the targets.** The `wasi` round trip through `examples/wasi-host.mjs`
   and through `web/wasi.mjs`'s `fd_pread`, plus whatever Q7 decides for
   freestanding wasm, with its negative test `reject_file_open_wasm`.
3. **F3: the example #710 asks for.** An HTTP/1.1 server under `examples/`
   that streams a file larger than its output buffer through
   `Http1Connection.write`. A check in `tests/run.js` measures peak RSS while
   the server serves a file eight times the window and requires it flat, inside
   a stated band, against a file the size of the window. Then `bun-http-framework-benchmark`'s
   `/video` route can be met. Submitting to it is the owner's call, as
   TechEmpower is in WP39 §4.

**The bar.** F1 lands when the native and Node runs print the same bytes for
every positive case and `mem_file_stream_flat` holds the arena flat. F3 lands
when RSS stays flat across a file at least eight times the window, measured
and stated in the commit's `Measured:` trailer.
