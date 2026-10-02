# Runtime: the C runtime's memory safety and its use of the OS

The security audit's record for the runtime stage (issue #363). It covers what
was checked, how, and what was found, and names the test that pins each
answer. Line numbers in the findings table refer to `main` at `bc6ad66`.

## Scope

| File | What was read |
| --- | --- |
| `runtime/runtime.c` | the arena (`nish_arena_grow`, `nish_alloc_struct`, marks, `nish_arena_keep`), every string function, the integer and Ryu formatters and their buffers, `nish_parse_number`, `Math.random`, `nish_alloc_array`, `nish_argv_init`, `nish_array_grow`, the panics |
| `runtime/nish.h` | every prototype and layout against its definition, and every contract comment against what the code does |
| `runtime/runtime-os.c` | the file reads and writes, `isDirectorySync`, `mkdirSync`, `readdirSync` and its sort, both spawns, `getenv`, `realpathSync` |
| `runtime/runtime-host.c` | `Date.now`, `crypto.getRandomValues` (short reads, `EINTR`, the limit), `statMtimeSync`, the signal pipe and its handler |
| `runtime/runtime-net.c` | every address, length and control-message buffer, descriptor flags and leaks on each error path, the readiness loop's output bounds |
| `runtime/runtime-parallel.c` | the partition arithmetic, the scope task list, thread-local state, thread-creation failure |
| `runtime/runtime-wasm.c` | the linear-memory arena, `nish_alloc_array`, `nish_array_grow` |

Read beside them, without owning them: `src/runtime.ts` (the declarations and
the inline allocator), the range checks `src/emit-builtins.ts` puts in front of
the network calls, `src/interop-wasm.ts` (the loader's `nish_alloc_array`),
`runtime/shim.mjs` (the Node twin) and `docs/security/codegen.md`, whose K1-6,
CG-3 and CG-9 were routed here.

## Threat model

The attacker controls the input of a well-typed program: every byte it reads
from a file, a socket or the environment, every name in a directory it lists,
how large a file is, what sits at a path it writes, and the strings it builds
from all of these. The attacker does not write the program and does not pick
its flags. The programmer is honest but writes ordinary code: a path assembled
from a request, a suffix check before an open, a listing of an upload
directory. A C host that calls `nish.h` directly is trusted to pass the sizes
it means.

A finding is any of these, reachable through a runtime entry point:

- an out-of-bounds access, or a block shorter than its header claims;
- a length the compiler's bounds-check elimination trusts and should not;
- a file opened, written or created other than the one the program named;
- memory or descriptors handed to the program uninitialised or leaked to a
  child;
- a cost in time or memory that grows faster than the attacker's input.

## Method

- **Every size computation, read for overflow and checked against its
  caller.** Each `nish_alloc_struct` and `malloc` in the C and wasm runtimes
  was traced back to where its size comes from. A size that could wrap was
  driven to wrap from a C harness. For the wasm runtime that harness was a
  module built with `scripts/build.sh --profile wasm` and run under Node.
- **Every length the runtime hands back, checked against 2^31 − 1.** Arrays
  and strings made from outside data (files, listings, concatenation, the host
  entry) were made at and past the limit, read with a sparse file where the
  input is a file, and their `length` read back under `--number-mode i32`.
  Exactly 2^31 − 1 is checked to still succeed for a file read, a
  concatenation and the host entry, so a limit one too low fails too. Those
  three checks run in a child whose arena points at 4 GiB of address space
  reserved with no access: a private, `PROT_NONE` mapping of a sparse file,
  with one read-write page for the headers. The host entry's elements are
  never touched. The concatenation's source starts in the inaccessible
  pages, and so does the file read's destination. The child faults on the
  first byte copied, and its handler checks that the arena handed out the
  whole block for that length. Nothing commits more than a page, so each
  check costs about a millisecond and no memory, and a run that passes is
  deterministic. Each was run against a build with the one `>` turned into
  `>=` and seen to fail.
- **Every path, name and argument, given an embedded NUL.** Each one was
  passed `name\0suffix` from a compiled program and directly, and checked for
  whether the call answered for `name`.
- **Every file the runtime creates, given a symbolic link at its name.** That
  covers both writers and both `spawnSyncTo` streams. The creation modes were
  read back under umask 022.
- **Every buffer and descriptor in `runtime-net.c`, read against the
  kernel's contract.** That means `recvmsg`'s `msg_namelen` and
  `msg_controllen`, `CMSG_NXTHDR`'s bounds, `accept4`'s flags, the 64-entry
  cap in the readiness loop, and the `i32` range of every byte count, which
  the compiled range check (`emitNetCall`) and Linux's `MAX_RW_COUNT` bound
  together.
- **Every loop over attacker-sized input, timed.** `readdirSync` was given
  3,000 and 100,000 names with its compares counted, by interposing
  `strcmp`.
- **The thread and signal code, read for races.** Each function was checked
  for which state is thread-local, which is shared and how that is ordered.
  The signal handler was checked for async-signal safety and `errno`.
  `nish_parallel_range` was built with
  `-fsanitize=signed-integer-overflow -fsanitize-trap=...`.
- **Every fix shown failing first.** Each regression test was run against the
  runtime at `bc6ad66` and seen to fail, then against this change and seen to
  pass. The `.text*` budget of every unit was measured with the suite's own
  check.

## Findings

| Id | Severity | Where (`bc6ad66`) | Description | Disposition |
| --- | --- | --- | --- | --- |
| RT-1 | High | `runtime/runtime-os.c:90`, `:95` (`nish_read_file_or_null`), `:112` (`nish_read_file_bytes`), `:120` (`nish_read_file`) | The runtime half of CG-3. A file of 2^31 bytes or more was read whole into a string or a `u8[]` whose `length`, under `--number-mode i32`, reads back negative. Bounds-check elimination trusts a length to be non-negative, so `const n = xs.length; const j = n - 1; xs[j]` on a 2^31 + 16 byte file read `xs[-2147483633]` unchecked: SIGSEGV in the reproducer, an out-of-bounds read in general. The attacker only has to make the file large, which a sparse file does at no cost | **Fixed.** `nish_read_file_or_null` refuses a file longer than 2^31 − 1 bytes before it allocates anything. That reaches all three readers through the failure path each already has for an unreadable file: `readFileSyncOrNull` and `readFileBytesSync` answer null, and `readFileSync` exits 1 with `nish: cannot read`. The runtime cannot tell which number mode compiled its caller, so the limit holds in both, as `nish_array_grow`'s does. It is also Node's own limit (`ERR_FS_FILE_TOO_LARGE`), so the two runtimes now agree. A file of exactly 2^31 − 1 bytes is still read. Tests: `tests/link/rt_sec_read_cap`, RT-1 in `tests/runtime-test.c` (both sides of the limit) |
| RT-2 | High | `runtime/runtime.c:199` (`nish_str_concat`) | `a + b` and every template literal concatenate through this function, with no limit on the result. Two strings read from files, each under the RT-1 limit, gave a string longer than 2^31 − 1 bytes, with RT-1's negative `length` and the same unchecked reads | **Fixed.** A result past 2^31 − 1 bytes fails as an allocation does (`nish: out of memory`, exit 1), checked before anything is copied. `nish_oom` became one cold function rather than a macro, so the seven call sites stopped paying for the message's address, and that saving keeps `runtime.c` under its ceiling. A result of exactly 2^31 − 1 bytes is still made. Test: RT-2 in `tests/runtime-test.c` (both sides of the limit) |
| RT-3 | Medium | `runtime/runtime-os.c:87`, `:127`, `:152`, `:159`, `:184`, `:194`–`:195`, `:243`, `:293`, `:324`; `runtime/runtime-host.c:101` | Every path, environment name and spawn argument went to the kernel as `s->data`, which the kernel reads to its first NUL, so a string holding a NUL named something else. `"README.md\0.txt"` passes `endsWith(".txt")` and reads `README.md`. A program that checks a suffix, a prefix or a pattern on a name it was given and then opens, writes, lists or spawns with it acted on a file it never checked. Node refuses all of these (`ERR_INVALID_ARG_VALUE`), so the native runtime also answered differently from `shim.mjs` | **Fixed.** `nish_cpath`, one `static inline` in `nish.h` that every path, name and spawn argument goes through, hands the kernel `""` for a string holding a NUL. `""` names nothing, so each call answers as it does for a missing path: null, false, `cannot read`/`cannot write` and exit 1, or a spawn that answers -1. A spawn argument holding a NUL answers -1, because its C string is not its own bytes. `statMtimeSync` answers NaN, and the RT-9 primitives answer -1 or false. Tests: `tests/link/rt_sec_path_nul`, RT-3 in `tests/runtime-test.c` |
| RT-4 | Medium | `runtime/runtime-os.c:127` (`nish_put_file`), `:194`–`:195` (`spawnSyncTo`'s file actions) | CLI-6 (`docs/security/cli.md`). `writeFileSync`, `appendFileSync` and `spawnSyncTo`'s streams opened with `O_CREAT` and no `O_NOFOLLOW`. `nish file.ts` writes `file.ll` beside its source, so a symbolic link planted at that name in a checkout truncated any file the user could write. Any program writing to a name in a directory someone else can write had the same flaw | **Fixed.** All four opens pass `O_NOFOLLOW`. A link as the last component is refused: `cannot write` and exit 1 from the writers, -1 from `spawnSyncTo`. A link among the directories on the way is still followed. Every caller in `src/`, `std/` and `tests/` writes a path it made itself or `/dev/null`, and none writes through a link. The compiler picks this up from the release that ships this runtime, because `build/nish-test` is linked with the seed's own runtime. One visible change: on Linux `/dev/stdout` is a link to `/proc/self/fd/1`, so `writeFileSync("/dev/stdout", …)` now fails, and `console.log` or `write` is the way to stdout. Test: RT-4 in `tests/runtime-test.c` |
| RT-5 | Medium | `runtime/runtime-os.c:255`–`:266` (`nish_readdir`) | `readdirSync` sorted its listing with an insertion sort. Whoever fills a directory chooses its length: 100,000 names took 2,507,163,583 compares and 12.5 s, and the cost grows with the square of the count | **Fixed.** An in-place heapsort: 3,019,323 compares and 0.071 s for the same 100,000 names, at most 2 n (log2 n + 1), with no allocation. Under `-ffunction-sections` the function grew 94 bytes. `nish_getenv` and `nish_realpath` now build their answers with `nish_str_new`, and `spawnSyncTo`'s two streams share one loop; between them that pays for the sort and RT-3 inside the unit's ceiling. Test: RT-5 in `tests/runtime-test.c`, which counts compares and checks the edges of the heap (0 to 3 names) |
| RT-6 | Low | `runtime/runtime-net.c:235` (`nish_net_put`), `:380`–`:402` (`nish_udp_recv_from`) | `recvmsg` reports no sender on a connected or Unix-domain socket (`msg_namelen` 0) and leaves the address buffer as it was: uninitialised stack. `udpRecvFrom` then copied 18 of those stack bytes into the program's `from`. The program chooses the descriptor, so this is a leak of this process's own stack to itself | **Fixed.** `nish_net_put` takes the length the kernel reported. It writes an address only for a full `AF_INET` or `AF_INET6` one, and eighteen zeros otherwise; `tcpAccept` passes its length too. Test: RT-6 in `tests/runtime-test.c` (a Unix datagram pair, over a dirtied stack) |
| RT-7 | Low | `runtime/runtime-wasm.c:228`–`:236` (`nish_arena_grow`), `:241` (`nish_alloc_struct`), `:258` (`nish_alloc_array`), `:265` (`nish_array_grow`); `runtime/runtime.c:1110` (`nish_alloc_array`) | CG-9 and its neighbours. In the wasm runtime, `off + size` could wrap 2^64 into a small number the fast path took for "fits", moving the offset backwards so the next block landed on the first. A page count of 2^32 or more was truncated to the 32-bit `memory.grow` argument: a request of 2^48 bytes grew nothing and claimed 2^48 bytes of capacity. `nish_alloc_array(8, 2^61)` wrapped `len * elem_size` to 0 behind a header claiming 2^61 elements, in both runtimes. `nish_array_grow` in the wasm runtime had no K1-6 limit. Compiled code does not reach these: its own allocator's zero-fill traps first, and the loader cannot pass a JavaScript length that large. Each is reached by a C caller | **Fixed.** The wasm grow traps on a wrapped or 4 GiB-overflowing `need`. Its fast path compares `size <= cap - off` and traps on a size that rounding would wrap. Both runtimes' `nish_alloc_array` refuse a length past 2^31 − 1 (native: `nish: out of memory`; wasm: a trap), and the wasm `nish_array_grow` now keeps runtime.c's limit. Exactly 2^31 − 1 elements is still handed back by both. Tests: `tests/link/rt_sec_wasm_arena` (five probes, each in a fresh instance under Node, one of them at exactly 2^31 − 1), RT-7 in `tests/runtime-test.c` (both sides of the limit) |
| RT-8 | Low | `runtime/runtime-parallel.c:112` (`nish_parallel_range`) | `(len + grain - 1) / grain` is signed overflow, which is undefined behaviour, once `len` is within `grain` of 2^63. At `-O0` it ran the whole range on one thread; clang 18 at `-O2` happens to fold it into the right answer | **Fixed.** `len / grain + (len % grain != 0)`. With `-fsanitize=signed-integer-overflow -fsanitize-trap=signed-integer-overflow` the old code traps and the new one divides the range. Test: RT-8 in `tests/runtime-test.c` (threads build), which checks that a range of `INT64_MAX` is divided |
| RT-9 | Low | (new) `runtime/runtime-host.c` | CLI-7 and CLI-9 asked for primitives to check who owns a path and whether a program runs: `lstat`'s owner and mode, and `access(X_OK)` | **Added**, not yet used: `nish_lstat_owner_mode`, `nish_euid`, `nish_is_executable`, declared in `nish.h`, 133 bytes of `runtime-host.c` between them. `src/` may call a runtime function only once the last release declares it (the rolling freeze), so CLI-7 and CLI-9 stay open until the release after this one. Test: RT-9 in `tests/runtime-test.c` |
| RT-10 | Low | `runtime/runtime-host.c:143` (`nish_signal_fd`) | Two threads whose first `signalFd()` calls overlap each make a pipe. One pipe's write end goes to the handler, and the other thread's read end never hears a signal; the loser's pipe leaks too | **Open.** The fix is a compare-and-swap on the read end. No language program can make the overlap deterministically, so there is no failing-first test for it |
| RT-11 | Low | `runtime/runtime.c:253` (`nish_write`) | `console.log`, `write` and the panic message make one `write(2)` and ignore a short count. Output to a non-blocking stdout, or to a pipe when a signal arrives mid-write, is cut short silently | **Open.** A loop fits the budget, but on a non-blocking stdout it would end at the same `EAGAIN`. The loop alone shows no difference from outside, so it has no failing-first test |
| RT-12 | Low | `runtime/runtime-os.c:87`, `:127` | The descriptors the file reads and writes open are not `O_CLOEXEC`. A child another thread spawns while one is open inherits it | **Open.** It is reachable only with a `scope()` task doing file I/O while another spawns, and has no deterministic test |
| RT-13 | Low | `runtime/runtime-os.c:98` | The read loop stops at the first `pread` that fails, `EINTR` included, and answers the bytes so far as the whole file. A local disk does not interrupt a read; NFS mounted `intr` and FUSE can | **Open**, for the same reason as RT-11 |
| CG-3 (rest) | High | `src/emit-arrays.ts` (`join`) | `join` builds its string inline in the IR, not in the runtime, so it can still exceed 2^31 − 1 bytes | **Open** (`src/`, follow-up #382). With RT-1 and RT-2 fixed, every other runtime source of a string or array is bounded. A listing is bounded by `nish_array_grow`, a name by the file system (255 bytes), `getenv` and `argv` by `MAX_ARG_STRLEN` (128 KiB), and `realpathSync` by `PATH_MAX`. `/dev/stdin` as a pipe is unreadable here, since `lseek` fails on a pipe |

## Properties verified

| Property | How it holds | Pinned by |
| --- | --- | --- |
| No string or array the runtime makes is longer than 2^31 − 1, and one of exactly 2^31 − 1 is still made | RT-1, RT-2 and RT-7 for reads, concatenation and the host entry, K1-6 for `push`, the bounds above for the rest | `tests/link/rt_sec_read_cap`; RT-1, RT-2, RT-7 in `tests/runtime-test.c`; `tests/link/cg_sec_push_limit` |
| A path, name or argument holding a NUL names nothing | `nish_cpath` in `nish.h`, the one copy of the test, which the spawn argument loop also uses | `tests/link/rt_sec_path_nul`; RT-3 in `tests/runtime-test.c` |
| No file is written or truncated through a symbolic link at its name; a linked directory on the way still works | `O_NOFOLLOW` on all four opens | RT-4 in `tests/runtime-test.c` |
| Files are created 0644 and directories 0777, both under the umask (Node creates 0666; this is tighter) | the modes in `runtime-os.c` | "modes" in `tests/runtime-test.c` |
| `readdirSync` is sorted by bytes in O(n log n) compares | the heapsort | RT-5 in `tests/runtime-test.c`; `tests/cases/io_readdir` |
| `crypto.getRandomValues` fills every byte from the kernel's CSPRNG, loops on short reads and `EINTR`, never falls back, and refuses more than 65,536 bytes | `nish_random_fill` | "entropy" in `tests/runtime-test.c`; `tests/cases/os_random`, `os_random_limit` |
| `Math.random` is not used for key material | the standard library never calls it, and `std/crypto/x509.ts` tells callers to draw keys and serials from `crypto.getRandomValues` | nothing automated; checked with `grep -rn Math.random std/` |
| The number formatters fit their buffers at the widest value | 21 bytes for an i64 (20 digits and a sign), 32 for a double (25 used at most) | `tests/runtime-test.c` (`INT64_MIN`, and five doubles of 21 to 25 characters) |
| `nish_parse_number` stops at the string's own end | every string is NUL-terminated after its `len` bytes (literals, `nish_str_new`, `join`, `argv`, the reads), and the embedded-NUL case is pinned | `tests/runtime-test.c` (`"5\0"`) |
| No network call writes outside the caller's array | each checks its `u8[]`'s length before the call (`-22`); the byte ranges are checked in the IR as `i32`s, so a count fits the `i32` answer; `pollWait` writes at most `ready.length / 2` pairs | `test_net`, `test_udp`, `test_poll` in `tests/runtime-test.c`; `tests/cases/net_tcp_bounds`, `net_udp_bounds` |
| Every socket, accepted connection, loop and signal pipe is close-on-exec and non-blocking from creation on Linux | `SOCK_CLOEXEC`, `accept4`, `EPOLL_CLOEXEC`, `pipe2` | `test_net`, `test_udp`, `test_poll` in `tests/runtime-test.c` |
| The signal handler is async-signal-safe and keeps `errno` | it makes one non-blocking `write` | `tests/cases/os_signal`; the threads block of `tests/runtime-test.c` |
| No wasm allocation can claim memory the module does not have | RT-7 | `tests/link/rt_sec_wasm_arena` |
| A parallel range is divided without overflow and every chunk runs, however many threads could be made | RT-8; the chunks a failed `pthread_create` left run on the caller | RT-8 and `test_parallel_*` in `tests/runtime-test.c` |
| `waitpid` is not interrupted into leaving a child behind | the only handler the runtime installs is `SA_RESTART` | by reading; nothing automated |
| Every runtime unit stays inside its `.text*` ceiling | measured: `runtime.c` 3,562 / 3,584 (3,687 / 3,840 threaded), `runtime-os.c` 1,495 / 1,536, `runtime-host.c` 700 / 768, `runtime-net.c` 2,087 / 2,304, `runtime-parallel.c` 286 / 320 (905 / 1,024 threaded) | the budget checks in `tests/run.js` |

## Doc corrections for the security-policy stage

- `docs/LANGUAGE.md`, the file builtins:
  - `readFileSync`, `readFileSyncOrNull` and `readFileBytesSync` treat a file
    longer than 2^31 − 1 bytes as unreadable, in both number modes. That
    matches Node.
  - `writeFileSync`, `appendFileSync` and `spawnSyncTo`'s two paths refuse a
    symbolic link as the last component, where Node follows it.
  - Every path, name and argument holding a NUL is refused: null, false, -1
    or `cannot …`, as for a missing path. Node also refuses these, by
    throwing.
- `docs/LANGUAGE.md`, strings: a concatenation or template whose result would
  pass 2^31 − 1 bytes fails as an allocation does (`nish: out of memory`,
  exit 1), in both number modes. `join` does not yet (CG-3).
- `runtime/shim.mjs` (the Node twin): `writeFileSync`, `appendFileSync` and
  `spawnImpl`'s `stream` should open with `O_NOFOLLOW` to keep the two
  runtimes agreeing on RT-4. `runtime/nish.d.ts`'s comments on those builtins
  should say the same.
- `docs/ARCHITECTURE.md` (the runtime budget table) and `docs/wp7-runtime.md`
  §"Runtime additions and budget": the "Today" figures are now those in the
  last row of the properties table. No ceiling moved.
- `docs/ARCHITECTURE.md` and `docs/wp7-runtime.md`: `nish_oom` is a function,
  and `runtime-host.c` also holds the RT-9 primitives.
- `docs/ARCHITECTURE.md` (the Runtime row, "The header is the public C ABI
  for both"): the header also defines one `static inline`, `nish_cpath`,
  which every path the runtime hands the OS goes through. It is written with
  `__builtin_strlen`, so the header still includes no libc header and still
  compiles for wasm32.
- `docs/security/codegen.md`: CG-9 is fixed (RT-7), and the runtime sources
  of CG-3 are closed (RT-1, RT-2); only `join` remains.
- `docs/security/cli.md`: CLI-6 is fixed in the runtime (RT-4) and reaches
  the compiler with the next release. CLI-7 and CLI-9 have their primitives
  (RT-9).
- `std/README.md` (crypto): the K1-6 caveat from `crypto-k1.md` now reads: no
  array or string the runtime makes passes 2^31 − 1, and a string built by
  `join` still can (CG-3).
- `src/runtime.ts` (CG-8): `nish_str_concat` and `nish_alloc_array` can now
  exit, as the allocator always could, so their `willreturn` is the same
  approximation CG-8 records.
