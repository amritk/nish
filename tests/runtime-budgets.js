// The runtime's `.text*` ceilings, in one place: the gate in tests/run.js
// (`node tests/run.js runtime-budget`) measures every row against its ceiling, and
// scripts/size-report.sh prints the same rows with the same ceilings, so neither can
// show a number the other does not apply. The report's ceilings used to be written
// into its own row labels, and stayed at 3,584 and 1,280 for two of the nine rows
// while the constants below moved -- see docs/wp7-runtime.md, "Runtime additions
// and budget", for what each ceiling is and why each moved.
//
// Run as a script, this prints one tab-separated line per row for the size report:
// label, source, ceiling, constant, flags. The flags come last because a shell's
// `read` folds two adjacent tabs into one, and most rows have none.

/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime.c`.
 *
 * Measured 3,480 bytes on 2026-09-12 with clang 18.1.3 on linux-x64 (`.text` 3,449 plus
 * `.text.unlikely.` 31), the whole runtime's 4,670 less the 1,190 bytes that moved into
 * runtime-os.c. The budget is the next 256-byte boundary above that measurement, so 104
 * bytes are left. That is deliberately tight: this half is a closed set, so a commit that
 * needs the room is a commit that grew something which was not supposed to grow, and
 * raising this number -- unlike raising the one below it -- should be rare enough to be
 * argued for. Either way it comes with its own measurement and a row in
 * docs/wp7-runtime.md ("Runtime additions and budget"); it is not a way to get green.
 *
 * Raised by 21 bytes, from 3,584 to 3,605, for `nish_wipe` (#385, `secureZero`): measured
 * 3,583 before it and 3,604 with it on 2026-10-03 with clang 18.1.3 on linux-x64. Every
 * other unit was as close to its own ceiling, and the wipe is no system call, so it is here,
 * and the raise is the measured size of what was added and nothing more.
 *
 * Raised by 1 more, to 3,606, by checked signed arithmetic: `nish_panic_overflow` sits
 * beside the division panic and the two share one table of messages, which measured 3,606
 * against 3,604 the same day (docs/wp7-runtime.md, "Checked arithmetic").
 *
 * Raised by 16, to 3,622, for `nish_panic` (#611): `panic`, `expect` and a failed range
 * entry call it where they called `nish_write` and then `nish_exit`, so that the runtime
 * owns the message and the exit together and only the first of several panicking threads
 * prints. Measured 3,622 on 2026-10-12 with clang 18 on linux-x64. The claim that parks a
 * second panic is compiled only into the threads build below; here it is empty.
 *
 * Raised by 34, to 3,656, in the same change, for retrying `write` on `EINTR` in
 * `nish_write`, the one place a panic's message is written: a C host may install a signal
 * handler without `SA_RESTART`, and the loop used to stop there and lose the rest of the
 * message. Measured 3,656 against 3,622 on 2026-10-16 with clang 18 on linux-x64; calling
 * `exit` rather than `_exit` after the claim measured the same.
 *
 * Raised by 28 more, to 3,684, in the same change: the newline is retried on `EINTR` as
 * well, and `nish_die`, the arithmetic and out-of-memory panics, writes its message through
 * the same retrying loop (`nish_write_all`) instead of `fputs`, which gives up on `EINTR`.
 * Measured 3,684 on 2026-10-16 with clang 18 on linux-x64.
 *
 * Raised by 14, to 3,698, for `nish_fatal_exit` (`nish:term`): a panic that ends in
 * `_exit` runs no atexit handler, so it calls this where it called `_exit(1)`, and it
 * runs `nish_fatal_hook` first, which `setRawMode(true)` sets to its restore. Without it
 * a failed bounds check in a terminal UI left the shell in raw mode. Each call site is a
 * call where a call was, so the raise is the function alone (a load, a test, the
 * hook's call and the `_exit`); the hook's pointer is `.bss`. Measured 3,698 against
 * 3,684 on 2026-10-23 with clang 18 on linux-x64; calling the hook from the inlined
 * `nish_panic_claim` instead measured 3,752, because every site grew its own test.
 * It is not a unit of its own, as the rule for an addition asks, because `runtime.c`
 * links alone (a C host's one file, and the direct `clang` lines in `tests/run.js`) and
 * its own panics call it: defined in `runtime-term.c` the core measured 3,675, and a
 * lone `runtime.c` no longer linked.
 *
 * Lowered by 1,975, to 1,723, by WP50 stage 4: strings and number formatting (the
 * concatenation, the comparisons, `String(x)` and the Zmij shortest-`f64` printer) moved to
 * `runtime/runtime-text.c`, which compiles freestanding for wasm32 and has a ceiling of its
 * own below. Measured 1,723 against 3,495 before the move on 2026-11-08 with clang 18.1.3
 * on linux-x64; the two halves sum to 3,510, 15 more than the one file, which is the
 * calls the compiler could inline across one file and now makes across two.
 *
 * Raised by 96, to 1,819, by ASYNC-15 (docs/security/async.md): an `awaitAll` lane's
 * adopt carves what the caller's chunk had left into a chunk of its own, marked by bit 0
 * of its cap, so every walker of the chunk list reads the cap through a mask, the frees
 * pass a carved chunk by, `nish_reset_arena` keeps the first chunk that is not carved,
 * and `nish_arena_keep` leaves a carved head alone. Measured 1,819 against 1,723 on
 * 2026-11-09 with clang 18.1.3 on linux-x64. It is not a unit of its own because those
 * walkers are the core's.
 */
// TEXT here is the .text section of the core runtime.c, not runtime-text.c (next).
const RUNTIME_TEXT_BUDGET = 1819
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-text.c`:
 * strings (`nish_str_*`) and the number formatting (`nish_f64_format`, the Zmij tables'
 * code), moved out of `runtime.c` by WP50 stage 4 so that a wasm module can link them
 * without the rest of the host runtime.
 *
 * Measured 1,787 on 2026-11-08 with clang 18.1.3 on linux-x64. The threads build is the
 * same size (nothing in the file is per-thread), so it has one row, not two.
 */
// The .text of the unit runtime-text.c, the strings and number formatting.
const RUNTIME_TEXT_UNIT_BUDGET = 1787
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-os.c`.
 *
 * Measured 1,251 bytes on 2026-09-14 with clang 18.1.3 on linux-x64 (`.text` 1,216 plus
 * `.text.unlikely.` 35, which is `nish_io_fail`), for the file I/O, the directory and
 * subprocess calls, `getenv`, the monotonic clock and the two constant host strings. It
 * was 1,190 until WP21 S2 put the `fstat`/`S_ISDIR` guard in `nish_read_file_or_null`,
 * which is 61 of those bytes and is what makes reading a directory answer null rather
 * than ask the arena for `LONG_MAX`.
 *
 * **Raised to 1,536 on 2026-09-20 by `nish_realpath`**, which is what the paragraph
 * that used to stand here said would happen: 29 bytes were left, a syscall wrapper does
 * not fit in 29 bytes, and the next one to reach into the operating system raises this
 * number in the commit that adds it rather than borrowing room from the arena to hide
 * in. Measured **1,347 bytes** (`.text` 1,312 plus `.text.unlikely.` 35) with clang 18
 * on linux-x64, so `nish_realpath` is **157** of them and the budget is the next
 * 256-byte boundary above the new measurement, leaving 189.
 *
 * 8 of those 157 are a portability choice worth its own number, because the cheaper
 * spelling is the wrong one. `realpath(p, NULL)` measures 1,339 and allocates the
 * result, which is POSIX 2008 -- but on Darwin it is the `__DARWIN_EXTSN` variant that
 * implements it, and which variant a translation unit binds depends on its
 * feature-macro level. A caller-supplied `PATH_MAX` buffer is defined for both, so it
 * is the spelling that cannot depend on that, and 8 bytes is what it costs.
 *
 * The two together are 5,120; they were 4,864, which was exactly the single budget they
 * replaced -- a coincidence then and not a constraint now.
 *
 * WP34 N2's `nish_read_file_bytes` (`readFileBytesSync`) spends **46** of the 189:
 * measured **1,393 bytes** on 2026-09-28 (`.text` 1,358 plus `.text.unlikely.` 35) with
 * clang 18 on linux-x64, leaving 143. It is that small because it reads nothing itself:
 * it hands the bytes `nish_read_file_or_null` already put in the arena to a fresh array
 * header, so there is one read path and one `S_ISDIR` guard for both builtins.
 *
 * It measured **1,530 bytes** at the head WP34 N12 started from, 6 under the ceiling.
 * **Raised to 2,560 by WP34 N12**, measured **2,383 bytes** on 2026-10-20 with clang
 * 18.1.3 on linux-x64, 853 more, in two parts. 276 are the new process builtins: `spawn`
 * (`nish_spawn_child`, 9, and the start factored out of `nish_spawn_impl`, 31 more for
 * its errno answers), `kill` (53), `waitPid` (134) and `totalMemory` (49), as
 * `-ffunction-sections` sizes them. The other 577 are not new: they are the CPU count
 * (`nish_cpu_online`, the affinity mask, the cgroup v2 quota and `NISH_NUM_THREADS`)
 * moved here from runtime-parallel.c, whose `--threads` row fell by 575, because
 * `availableParallelism` reads it in a build without `--threads` and that build of
 * runtime-parallel.c compiles none of it. The two files together grew by 278. The
 * budget is the next 256-byte boundary above the measurement, leaving 177.
 *
 * It measured **2,380 bytes** at the head WP37's file builtins started from. **Raised to
 * 2,816 by `renameSync`, `unlinkSync`, `writeFileBytesSync` and `writeBytes`**, measured
 * **2,745 bytes** on 2026-10-29 with clang 18.1.3 on linux-x64, 365 more, as
 * `-ffunction-sections` sizes them: `nish_rename` 85, `nish_unlink` 53,
 * `nish_write_file_bytes` 139 and `nish_write_bytes` 34, plus `nish_put_all` (106), the
 * write loop the two byte writers share with `writeFileSync`, which took `nish_put_file`
 * from 142 to 93. `writeBytes` lives here rather than beside `write` in runtime.c because
 * that file is a closed set and its loop answers nothing: sharing it would have grown
 * runtime.c by 21 bytes past its ceiling. The budget is the next 256-byte boundary above
 * the measurement, leaving 71.
 *
 * **Raised to 3,072 when `main`'s `setNice` and `setIdlePriority` met them**, measured
 * **2,822 bytes** on 2026-10-29 with clang 18.1.3 on linux-x64: `nish_set_nice` 31 and
 * `nish_set_idle_priority` 46, which fit the old 2,560 alone and the 2,816 above only
 * without each other's 77. The budget is the next 256-byte boundary, leaving 250.
 *
 * **Raised to 3,328 by `writeFileSyncMode`, `createFileExclusiveSync` and
 * `mkdirSyncMode`** (#992), measured **3,174 bytes** on 2026-10-29 with clang 18.1.3 on
 * linux-x64, 346 more, as `-ffunction-sections` sizes them: `nish_put_file_mode` 253,
 * the open, `fchmod`, write and the `unlink` of a failed exclusive create that the two
 * file builtins share, `nish_write_file_mode` and
 * `nish_create_file_exclusive` 12 each, and `nish_mkdir_mode` 72. They are file calls
 * beside `nish_put_file` and `nish_put_all`, which they reuse, so they belong in this
 * file. The budget is the next 256-byte boundary above the measurement, leaving 154.
 *
 * **Raised to 4,608 for `spawnPiped`**, measured **4,450 bytes** on 2026-10-29 with
 * clang 18.1.3 on linux-x64, from 3,174 on `main`: under `-ffunction-sections`,
 * `nish_spawn_piped` 1,082 (three pipes, the `poll` loop that writes stdin while it reads
 * both outputs, the 16 MiB cap and SIGPIPE blocked on the calling thread,
 * docs/security/runtime.md RT-27 to RT-31), `nish_pipe` 109 (close-on-exec ends off descriptors 0 to 2), and
 * `nish_spawn_start` 284 to 365 for the descriptors it now hands the child and the failed `dup2` action it refuses; the rest is
 * layout. The poll loop is the cost of not deadlocking against a child that writes before
 * it has read everything. The budget is the next 256-byte boundary, leaving 158.
 *
 * **Raised to 4,864 for `spawnWithFds`**, measured **4,726 bytes** on 2026-10-31 with
 * clang 18.1.3 on linux-x64, from 4,514 at the head it started from: under
 * `-ffunction-sections`, `nish_spawn_with_fds` 178 (the 64-descriptor bound and the
 * `F_DUPFD_CLOEXEC` copies above every target, which make self-dups and collisions one
 * case, docs/security/runtime.md RT-40) and `nish_spawn_start` 365 to 380 for the base its
 * `dup2` actions count from. It is `spawn` with descriptors handed on, so it belongs beside
 * `nish_spawn_start`, which it reuses. The budget is the next 256-byte boundary, leaving 138.
 *
 * **Raised to 5,376 for `spawnPipedWithin`**, measured **5,225 bytes** on 2026-11-11 with
 * clang 18.1.3 on linux-x64, from 4,858 on `main`: under `-ffunction-sections`, the
 * capture loop moved into `nish_spawn_piped_within` at 1,444 (1,089 as
 * `nish_spawn_piped`), the deadline read on the monotonic clock, the `poll` wait it
 * bounds, the SIGKILL and the `WNOHANG` reap with its doubling nap that keep the final
 * wait inside the deadline (docs/security/runtime.md RT-49), and `nish_spawn_piped` is a
 * 9-byte call with no deadline. One loop serves both, so `spawnPiped` costs nothing
 * twice. The budget is the next 256-byte boundary, leaving 151.
 *
 * **Raised to 5,888 for WP44's streaming reads** (`fileOpen`, `fileReadAt`, `fileSize`,
 * `fileClose`, docs/wp44-streaming-files.md), measured **5,705 bytes** on 2026-11-11 with
 * clang 18.1.3 on linux-x64, from 5,225 with `spawnPipedWithin` in: under
 * `-ffunction-sections`, `nish_file_open` 169 (the empty-or-NUL path refusal, the `fstat`
 * regular-file test and the close of what it refuses), `nish_file_read_at` 115 (the `pos` refusal and the `EINTR` retry),
 * `nish_file_size` 50, `nish_file_close` 27 (each before the refusal of a negative descriptor,
 * -9 before the call, which WASI would otherwise answer -22, which added 26 across the three) and `nish_fs_err` 96, the errno table by name
 * that gives Darwin and WASI Linux's numbers (its 76-byte jump table is `.rodata`). They
 * are file reads beside `nish_read_file_or_null`, and §7 links them into a WASI build
 * through this file, so they are here rather than in a unit of their own. The budget is the
 * next 256-byte boundary, leaving 183. The 480 bytes are the same before and after
 * `spawnPipedWithin` (5,338 from 4,858 without it).
 *
 * The file measures **5,761 bytes** on 2026-11-12, same toolchain: 5,791 after the
 * exec grant's identity check (#1447), then 30 given back when a spawn under an exec
 * allowlist was handed whole to `runtime-sandbox.c`. The ceiling stands, leaving 127.
 */
const RUNTIME_OS_TEXT_BUDGET = 5888
/**
 * Ceiling on the same `runtime.c` compiled with `-DNISH_THREADS=1`, which is the build
 * `--threads` links (WP20 T0): the arena and the RNG seed become `_Thread_local`.
 *
 * Measured 3,605 bytes on 2026-09-12 with clang 18.1.3 on linux-x64, 125 more than the
 * default build and 21 *above* `RUNTIME_TEXT_BUDGET` — which is exactly why it needs a
 * number of its own instead of sharing one. The default measurement cannot see this
 * configuration, so without a row of its own the threads build's code size was ungated
 * while the gate stayed green: `--threads` is a flag a user passes, not a experiment, and
 * `_Thread_local` storage is the kind of thing that grows quietly.
 *
 * It is deliberately a *separate* ceiling rather than a raised shared one. Making the core
 * budget 3,840 to cover both would give the default build 360 bytes of room it has no
 * business having, and the point of the split was that a number should mean one thing.
 *
 * Raised by 20, to 3,860, by #611: the first-panic claim (measured 3,826 with it, under the
 * old 3,840) and then the `EINTR` retry in `nish_write` (34 bytes, as above), measured
 * 3,860 on 2026-10-16 with clang 18 on linux-x64, and then 3,885 with the newline's retry
 * and `nish_die` writing through the same loop (as above). The raise is what was measured
 * and no more, as `nish_wipe`'s was.
 *
 * Raised by 14, to 3,899, for `nish_fatal_exit` (as above), measured 3,899 against 3,885
 * on 2026-10-23 with clang 18 on linux-x64.
 *
 * Lowered by 1,961, to 1,938, by WP50 stage 4's move of strings and number formatting to
 * `runtime-text.c` (as above): measured 1,938 against 3,710 before it on 2026-11-08 with
 * clang 18.1.3 on linux-x64.
 *
 * Raised by 87, to 2,025, by ASYNC-15's carved chunk (as above), measured 2,025 against
 * 1,938 on 2026-11-09 with clang 18.1.3 on linux-x64.
 */
const RUNTIME_THREADS_TEXT_BUDGET = 2025
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c
 * runtime/runtime-parallel.c` -- the half that divides a range of work across
 * threads (WP20 T1, the stage under wp29's surface).
 *
 * Two rows, for the same reason the two above are two: the file compiles in both
 * configurations and they are not the same file. Without `-DNISH_THREADS` it is the
 * sequential fallback and measured **49 bytes** on 2026-09-18 with clang 18.1.3 on
 * linux-x64 -- one bounds test, a call, and the cached CPU count -- and the 207 bytes
 * of slack under the 256-byte boundary are not room to spend: the point of gating the default build is
 * that nothing but a fallback belongs in it, so a commit that needs the room has put
 * code on the path a program which never spawns still links.
 *
 * Raised to 320 by wp29 P2, measured **286 bytes** on 2026-09-27 with clang 18.1.3 on
 * linux-x64: a scope's tasks exist in this configuration too — filed by
 * `nish_scope_spawn` and run, on the calling thread, by `nish_scope_join` — because a
 * task stores its answer when its scope joins in every build, and a build that stored
 * it at the spawn instead would give a program that reads its destination early a
 * different answer. That is the fallback's own semantics rather than room spent, and
 * 34 bytes of slack are left, not 207.
 *
 * wp29 P3 adds `nish_mutex_wait`, a lock's contended path, which every configuration
 * defines so that a `nish/threads` program links on WASI too: measured **304 bytes** on
 * 2026-10-11 with clang 18.1.3 on linux-x64, 18 more, inside the same ceiling.
 *
 * Raised to 768 by wp29 P3's channels, measured **597 bytes** on 2026-10-11 with clang
 * 18.1.3 on linux-x64 (304 before them, with P3's `nish_mutex_wait`): `nish_channel_send`,
 * `nish_channel_count` and `nish_channel_receive` and the helper that makes a channel's
 * buffer on first use. A channel's buffer lives outside every arena in every build,
 * because a value sent outlives its sender's arena whether the sender ran on a thread of
 * its own or, as here, on the calling thread at the join, so the fallback carries all of
 * it but the lock and the wait. The ceiling is the next 256-byte boundary above the
 * measurement, as every ceiling here was set.
 *
 * The worker pool measured **610 bytes** on 2026-10-11 with clang 18.1.3 on linux-x64,
 * 13 more, inside the same ceiling: `nish_pool_disable`, which a Node addon's shim
 * calls whatever the build, and which does nothing in this one. The pool itself is
 * `-DNISH_THREADS` only.
 */
const RUNTIME_PARALLEL_TEXT_BUDGET = 768
/**
 * Ceiling on the same file with `-DNISH_THREADS=1`, which is the build `--threads`
 * links: the partitioner, the worker trampoline, `pthread_create`/`join` and the
 * nesting guard.
 *
 * Measured 482 bytes on 2026-09-18 with clang 18.1.3 on linux-x64. This is the number
 * that made the file a third translation unit rather than a third of `runtime-os.c`,
 * which had 29 bytes of its ceiling left: 482 bytes of partitioner does not fit in 29,
 * and raising the syscall half's ceiling to hold it would have moved the number a
 * reader sees for "the operating-system surface" for a reason that has nothing to do
 * with the operating system. Section GC means a program that runs nothing in parallel
 * pays none of it, and `examples/hello.ts` is checked to be the same size to the byte.
 *
 * Raised to 1,024 by wp29 P2, measured **901 bytes** on 2026-09-27 with clang 18.1.3 on
 * linux-x64: the 419 bytes are a scope's tasks — `nish_scope_spawn`, which copies a
 * task's payload into a list of its own, `nish_scope_join`, which runs a scope's tasks
 * one thread each and joins them, and the worker that frees each thread's arena. They
 * are this file's subject, the language's other way of dividing work across threads,
 * and a program that never opens a scope still pays none of it.
 *
 * wp29 P3's `nish_mutex_wait` measured **954 bytes** in all on 2026-10-11 with clang
 * 18.1.3 on linux-x64, 49 more for the spin and the yield, inside the same ceiling.
 *
 * Raised to 1,536 by wp29 P3's channels, measured **1,403 bytes** on 2026-10-11 with clang
 * 18.1.3 on linux-x64 (954 before them, with `nish_mutex_wait`): the same three entry
 * points as the fallback's row above, with the mutex and condition variable that let a
 * receiver wait for a sender on another thread.
 *
 * Raised to 2,816 by the worker pool, measured **2,660 bytes** on 2026-10-11 with clang
 * 18.1.3 on linux-x64 (1,403 before it). The 1,257 bytes are three things. The pool:
 * workers started once and parked, a first-in-first-out queue the caller drains too,
 * the spin before a thread parks, the arena rewound after each job, the fork handler,
 * and the per-call threads it keeps for an addon (`nish_jobs_run` is 542 bytes and the
 * drain loop it shares with the workers 271).
 * The core count: the affinity mask, the cgroup v2 quota read up the hierarchy, and
 * `NISH_NUM_THREADS` (`nish_cpu_count` went from 48 bytes to 532 with them). And the
 * small pieces that route a region and a join through the queue. They are this file's
 * subject, and they took a divided region from ~100 us to ~10 us (docs/wp20-threads.md
 * §8e). A program that never divides a region or joins a scope still pays none of it.
 *
 * threads-complete's copy-at-join measured **2,665 bytes** on 2026-10-16 with clang
 * 18.1.3 on linux-x64, 5 more, inside the same ceiling: the copies themselves are
 * `runtime-cross.c`'s, below.
 *
 * threads-complete's adoption measured **2,695 bytes** on 2026-10-16 with clang 18.1.3
 * on linux-x64, 30 more, inside the same ceiling: the two `mallopt` calls with which
 * the pool's first start fixes glibc's trim and mmap thresholds, so that an arena's
 * release no longer hands a task's 1 MB temporary back to the kernel and faults it in
 * again on the next call (200 such tasks: 314 ms at one thread before, 48 ms after).
 * Only under glibc: WASI and darwin compile none of it.
 *
 * Its idle trim measured **2,805 bytes** on 2026-10-17 with clang 18.1.3 on linux-x64,
 * 110 more, inside the same ceiling: a worker that freed an arena larger than one chunk
 * waits for its next job with a one-second timeout and calls `malloc_trim(0)` when it
 * runs out, so a parked pool hands a burst's temporaries back to the kernel (an idle
 * 68 MB after ten rounds of 8 tasks that each build 16 MB, 52 MB with the trim).
 *
 * Raised to 2,944 by the trim reaching the workers' arenas, measured **2,900 bytes** on
 * 2026-10-17 with clang 18.1.3 on linux-x64, 95 more: `malloc_trim(0)` cuts back only
 * the main arena's top, and a worker's arena keeps a burst's top below the 64 MB trim
 * threshold, so the parked worker lowers the threshold, frees a 16 MB block through its
 * own arena and then trims, and the next region restores the threshold
 * (`nish_pool_drain` 381 → 441 bytes, `nish_jobs_run` 572 → 607). Four maps of 1.2
 * million strings on four threads idled at 82 MB before and 2.3 MB after
 * (`tests/link/par_map_idle`), the ten rounds of 16 MB tasks at 52 MB and 2.3 MB. The
 * file had nothing to give: the bytes are the pool's, and dropping the 64 MB threshold
 * instead cost the bursts it was set for (586-700 ms against 440-466 ms on the 1.2
 * million strings).
 *
 * Raised to 3,328 by threads-followups' dynamic pieces, measured **3,097 bytes** on
 * 2026-10-20 with clang 18.1.3 on linux-x64 (2,900 before them), 197 more: a divided
 * region is cut into up to eight pieces a thread, which the threads claim one at a
 * time off an atomic counter (`nish_par_run` 21 → 102 bytes, with `nish_par_piece` 49
 * and `nish_par_run_lead` 21 new, `nish_parallel_range` 245 → 280), and a worker
 * rewinds its arena between pieces. On bench/par-heavy.ts at four threads they took the
 * median from 846 ms to 792 ms (15 interleaved rounds; the copy band 834-846), the
 * slowest thread no longer holding the join a quarter of each region. The fallback's
 * row above is unchanged at 610 bytes: none of it is compiled there.
 *
 * **Lowered to 2,560 by WP34 N12**, measured **2,522 bytes** on 2026-10-20 with clang
 * 18.1.3 on linux-x64, 575 fewer: the CPU count's reading (the affinity mask, the cgroup
 * v2 quota and `NISH_NUM_THREADS`) moved to runtime-os.c as `nish_cpu_online`, which
 * `availableParallelism` calls in every build, and `nish_cpu_count` here keeps only its
 * cache and the call. The ceiling comes down with it, to the next 256-byte boundary
 * above the measurement, so the room the move freed is not left for something else.
 * WP37's `nish_cpu_prime` and the ceiling `nish_cpu_count` clamps to took it to
 * **2,558 bytes** on 2026-10-24, 2 under the ceiling.
 *
 * WP37's `nish_cpu_prime` measured **2,558 bytes** on 2026-10-24 with clang 18.1.3 on
 * linux-x64, 39 more than the 2,519 the file measured before it: the call `--sandbox`
 * makes to read the CPU count before Landlock closes /sys/fs/cgroup, kept as a ceiling
 * that the first region's fresh read (which sees `NISH_NUM_THREADS`, unset while
 * `.preinit_array` runs) may lower. The fallback above measured 608, 1 more, inside its
 * ceiling.
 *
 * **Raised to 2,896 by `scopeWithStack`**, measured **2,881 bytes** on 2026-10-31 with
 * clang 18.1.3 on linux-x64, 323 more: a scope with a stack runs each task on a thread of
 * its own made with that stack, the size rounded to the page and a guard page below it
 * (`nish_jobs_run_sized`, 256 in `.text.unlikely`), and `nish_stack_fail` (51, cold) ends
 * the program when one cannot be started, saying whether the system was out of threads
 * or memory. Both are out of line and cold, so `nish_scope_join`, which
 * `-ffunction-sections` sizes at 133 against 117 before, gains only the load of the
 * scope's stack and a predicted branch. Inlined, the sized path made it 328. A thread per
 * task reuses the unpooled path's `nish_job_thread`; a queue that a CPU-count of sized
 * threads shared measured 3,166. The fallback measured 608, unchanged.
 */
const RUNTIME_PARALLEL_THREADS_TEXT_BUDGET = 2896
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-cross.c`
 * -- the copies at a join (threads-complete's copy-at-join): `nish_cross_out` and
 * `nish_cross_in`, which copy a task's or a chunk's `string` or scalar array out of the
 * arena it was made in and into the one that takes it, `nish_cross_send`, which copies
 * every string a `Channel<string>` sends, `nish_cross_keep`, which moves a map's element
 * into its chunk's transfer block as the chunk loop rewinds the arena,
 * `nish_cross_begin`, `_end` and `_adopt`, which open a chunk's transfer list and link
 * its blocks into the caller's arena, and `nish_guard_keep` with the set of the copies a
 * `Mutex` owns.
 *
 * Measured **1,170 bytes** on 2026-10-16 with clang 18.1.3 on linux-x64. A copy-out first
 * collects the arena's spans since the mark and sorts them, so that a map's million
 * slots each take a binary search rather than a walk of every chunk. Every configuration
 * defines them, because a task's arena is rewound once it has returned whether it ran on
 * a thread of its own or on the calling thread at the join. An eighth translation unit
 * rather than more of `runtime-parallel.c`: folded in, they took that file from 610
 * bytes to 1,786 against its ceiling of 768, and the rule is a new file with its own
 * measured ceiling, never a raised one. A program that sends, answers or guards no
 * string pays none of it. The budget is the next 256-byte boundary above the
 * measurement, as every ceiling here was set.
 *
 * threads-complete's adoption measured **1,196 bytes** on 2026-10-16 with clang 18.1.3
 * on linux-x64, 26 more, inside the same ceiling. A map's answers are no longer copied
 * out of the worker's arena range by range and copied in again at the caller: each
 * element is moved once, into a transfer block, and the caller links the blocks into its
 * own chunk list (`nish_cross_adopt`), as `nish_cross_in` now links a task's answer of
 * 64 KB or more. That retired the `_range` pair and the sorted span table, and paid for
 * the transfer list and the adoption.
 *
 * The copy-back join measured **1,427 bytes** on 2026-10-17 with clang 18.1.3 on
 * linux-x64, 231 more, and the ceiling moves to 1,536. Every chunk took a 64 KB block
 * however little it kept, and adopting it left the caller's current chunk behind, so a
 * small map run in a loop grew without bound (`link/par_map_join_small`). Blocks now
 * start at 4 KB and double to 64 KB, each records what it used when its chunk ends, and
 * a join that kept under 64 KB in all copies its elements into the caller's arena and
 * frees the blocks rather than adopting them.
 *
 * The one-thread rewind measured **1,552 bytes** on 2026-10-20 with clang 18.1.3 on
 * linux-x64, 108 more than the 1,444 it sat at, and the ceiling moves to 1,664.
 * `nish_cross_keep` rewinds through `nish_rewind`, inlined (262 → 370): when an
 * element's body grew a 64 KB chunk past a mark at the end of a full one, the chunk is
 * kept, emptied, rather than freed, so a map at one thread stops doing a `malloc` and a
 * `free` per element. 1M short strings at `NISH_NUM_THREADS=1` went from 72.8 ms to
 * 54.9 ms, inside the loop's 56.4–57.6 ms band.
 */
const RUNTIME_CROSS_TEXT_BUDGET = 1664
/**
 * Ceiling on the same file with `-DNISH_THREADS=1`: measured **1,235 bytes** on
 * 2026-10-16 with clang 18.1.3 on linux-x64, 65 more than the row above for the lock
 * `nish_guard_keep` takes over the set of a `Mutex`'s copies, which another thread's
 * guard may be changing.
 *
 * threads-complete's adoption measured **1,277 bytes** on 2026-10-16 with clang 18.1.3
 * on linux-x64, 42 more, inside the same ceiling: the row above's change, with the
 * chunk's transfer state thread-local here, which takes 16 bytes more to reach than
 * the row above's plain static.
 *
 * The copy-back join measured **1,508 bytes** on 2026-10-17 with clang 18.1.3 on
 * linux-x64, 231 more, and the ceiling moves to 1,536: the row above's change.
 *
 * The one-thread rewind measured **1,631 bytes** on 2026-10-20 with clang 18.1.3 on
 * linux-x64, 118 more than the 1,513 it sat at, and the ceiling moves to 1,664: the row
 * above's change (`nish_cross_keep` 264 → 382).
 */
const RUNTIME_CROSS_THREADS_TEXT_BUDGET = 1664
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-host.c`
 * -- the wall clock, entropy, a file's modification time and the signal descriptor
 * (WP34 N3): `Date.now`, `crypto.getRandomValues`, `statMtimeSync`, `signalFd` and
 * `readSignal`.
 *
 * Measured **571 bytes** on 2026-09-29 with clang 18 on linux-x64 (`.text` 514 plus
 * `.text.unlikely.` 57, which is the entropy panic): `nish_date_now` 53,
 * `nish_random_fill` 86 and its panic 57, `nish_stat_mtime` 83, `nish_signal_fd` 150,
 * its handler 53 and `nish_read_signal` 89. They are a fourth translation unit rather
 * than more of `runtime-os.c` because that file had 143 bytes of `RUNTIME_OS_TEXT_BUDGET`
 * left and these are 571, and the rule is a new file with its own measured ceiling,
 * never a raised one; `runtime-os.c` is untouched. The budget is the next 256-byte
 * boundary above the measurement, as every ceiling here was set.
 *
 * The signal half is a handler writing to a pipe rather than a `signalfd` on Linux,
 * which measured 503 in all: a `signalfd` hears only a signal blocked in every thread,
 * and a thread already running when `signalFd()` is called keeps its own mask, so the
 * cheaper form ended the process when the signal landed there (`test_host_signal_threads`
 * in tests/runtime-test.c).
 */
const RUNTIME_HOST_TEXT_BUDGET = 768
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-net.c`
 * -- the sockets of `nish:net` (WP34 N5): `netAddress`, `netLocalPort`, `tcpListen`,
 * `tcpListenFlags`, `tcpAccept`, `netRead`, `netWrite`, `netShutdown`, `netClose` and
 * `netSetOption` and `netMss`, then `udpBind`,
 * `udpSendTo` and `udpRecvFrom`, then the readiness loop: `pollCreate`, `pollAdd`,
 * `pollModify`, `pollRemove` and `pollWait`, then the Unix-domain calls: `unixListen`,
 * `unixListenMode`, `unixConnect`, `unixAccept` and `unixSocketPair`, then the
 * descriptor calls: `sendFd`, `recvFd` and `peerCredentials`.
 *
 * Measured **853 bytes** on 2026-09-29 with clang 18 on linux-x64, all of it `.text`,
 * **1,782 bytes** on 2026-09-30 once UDP, its segmentation offload and its ECN
 * control messages were added (the ceiling went from 1,024 to 2,048), and
 * **2,071 bytes** the same day once the epoll loop was added (2,048 to 2,304), and
 * **2,335 bytes** on 2026-10-20 once `tcpListenFlags` and its `SO_REUSEPORT` were
 * added (2,304 to 2,560), and **2,588 bytes** on 2026-10-29 once `netSetOption` and
 * its five-option whitelist were added (2,560 to 2,816), and **2,797 bytes** on
 * 2026-10-30 once `netMss` was added, inside the same ceiling, and **3,841 bytes**
 * on 2026-10-31 once the Unix-domain calls were added (2,816 to 4,096): most of the
 * growth is the stale-socket probe and the unlink on each failure after a bind. It
 * measured **4,511 bytes** on 2026-10-31 with clang 18.1.3 on linux-x64 once the
 * descriptor calls were added (4,096 to 4,608): under `-ffunction-sections`,
 * `nish_recv_fd` 318 (the control buffer for eight descriptors and the loop that keeps
 * the first and closes the rest), `nish_send_fd` 188, `nish_peer_credentials` 109 and
 * `nish_unix_only` 55, the family check the three share, leaving 97, and **4,619
 * bytes** on 2026-11-02 once `tcpListenFlags` flag 4 was added (4,608 to 4,864): the
 * two-instruction classic BPF program that steers a connection to the listener bound
 * in the place of the CPU that received it, its `SO_ATTACH_REUSEPORT_CBPF` call and
 * the flag checks. It went into `nish_net_bound`, sharing its close on failure, with
 * the program as static data; a separate attach function measured 4,684, and attaching
 * before the bind or inside the stream clause saved nothing under 4,608.
 * **4,879 bytes** on 2026-11-12 once `udpBind` flag 4 was added (4,731 to 5,120): the
 * seven-instruction classic BPF program that hands a QUIC datagram to the group's socket
 * at its DCID byte 0 modulo the group's count (docs/h3-multicore.md), copied from static
 * data so the count can be patched in, its attach, and the flag word's checks; as built
 * on the stack the program measured 4,893.
 * They are a fifth translation unit rather than more of `runtime-host.c` because the
 * surface grows -- UDP and the readiness loop were the second and third slices of N5,
 * and each raised this ceiling alone, with a fresh measurement in docs/wp7-runtime.md -- and
 * the rule is a new file with its own measured ceiling, never a raised one. The
 * budget is the next 256-byte boundary above the measurement, as every ceiling here
 * was set.
 */
const NET_TEXT_BUDGET = 5120
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-simd.c`
 * -- the byte searches that read a vector at a time (WP38 S1): `nish_str_index_of_any`
 * and `nish_regex_scan`, their scalar, base and AVX2 paths, the CPU question and the
 * resolvers that pick one.
 *
 * Measured **675 bytes** on 2026-10-09 with clang 18.1.3 on linux-x64, all of it
 * `.text`: the scalar path 105, SSE2 189, AVX2 169, the resolver 203 (the `NISH_SIMD`
 * pin and the `cpuid` question are inlined into it) and the entry point 9, the load
 * and tail call through the stored path. The AVX2 path and the resolver count here
 * because a binary that calls the kernel carries them whatever its CPU. A sixth
 * translation unit rather than more of `runtime.c` because that file had one byte of
 * `RUNTIME_TEXT_BUDGET` left, and the rule is a new file with its own measured
 * ceiling, never a raised one. The budget is the next 256-byte boundary above the
 * measurement, as every ceiling here was set.
 *
 * Measured **2,337 bytes** on 2026-10-23 once `nish/regex`'s match-start scan was
 * added (the ceiling went from 768 to 2,560): the scan's AVX2 path 1,323, its scalar
 * path 202, its resolver 97 and entry point 9; `indexOfAny`'s paths as before, and its
 * resolver 76 now that the CPU question, `nish_simd_choose` 158, serves both. The scan
 * is the same subject as `indexOfAny` -- a byte search a vector at a time, on the same
 * CPU question and `NISH_SIMD` pin -- so it raised this ceiling with a measurement in
 * docs/wp7-runtime.md rather than opening a file of its own.
 *
 * Measured **2,495 bytes** on 2026-10-29 once `Math.floor`, `ceil` and `trunc` took
 * SSE4.1's `roundsd` behind a CPU question (#943): `nish_round_init`, the
 * `NISH_SIMD` pin and the `cpuid` leaf it reads and the three libm pointers it
 * keeps on a CPU without SSE4.1, and the three entry points, each the pointer
 * test, `roundsd` and the indirect jump to libm. It is the same CPU question and pin
 * as the kernels above, so it lives here, inside the ceiling.
 */
const RUNTIME_SIMD_TEXT_BUDGET = 2560
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-aes.c`
 * -- AES-GCM on the CPU's AES instructions (WP38 S5): `nish_aes_hw`, its CPUID
 * question and `NISH_AES` pin, and the four kernels on AES-NI and PCLMULQDQ.
 *
 * Measured **2,532 bytes** on 2026-10-11 with clang 18.1.3 on linux-x64, all of it
 * `.text`: the key schedule with H and its powers 594, one block 84, GCTR 654, GHASH
 * 1,082 and the resolver 118. A seventh translation unit rather than more of
 * `runtime-simd.c`: folded in, the two measured 3,207 bytes against that file's
 * ceiling of 768, and the rule is a new file with its own measured ceiling, never a
 * raised one. Apart, a program that searches text carries no AES and one that speaks
 * TLS no byte search. The budget is the next 256-byte boundary above the measurement,
 * as every ceiling here was set.
 *
 * Measured **2,709 bytes** on 2026-11-13 with the same clang, after AEAD-4
 * (docs/security/crypto-aead.md): `nish_aes_clear`, 95 bytes out of line, zeroes the
 * vector and caller-saved general registers as each kernel tail-calls it, and GHASH
 * packs its middle operands to end a spill (1,155). Inlined into the four kernels
 * the clear measured 2,977. The row is in docs/wp7-runtime.md.
 */
const RUNTIME_AES_TEXT_BUDGET = 2816
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-sha256.c`
 * -- the SHA-256 block on the CPU's SHA instructions: `nish_sha256_hw`, its CPU
 * question and `NISH_SHA256` pin, and `nish_sha256_compress` on SHA-NI (or the ARMv8
 * SHA-256 instructions on AArch64).
 *
 * Measured **495 bytes** on 2026-10-30 with clang 18.1.3 on linux-x64, all of it
 * `.text`: the guard and the block 341, the resolver 154; the round constants are
 * `.rodata`. Its own translation unit rather than more of `runtime-aes.c`: a program
 * that hashes carries no AES, and the rule is a new file with its own measured
 * ceiling, never a raised one. The budget is the next 256-byte boundary above the
 * measurement, as every ceiling here was set.
 */
const RUNTIME_SHA256_TEXT_BUDGET = 512
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-chacha20.c`
 * -- ChaCha20's keystream on vectors (WP38 S10): `nish_chacha20_hw`, its CPUID and
 * XGETBV question and `NISH_CHACHA20` pin, and `nish_chacha20_xor`, the eight-block
 * AVX2 loop, the four-block 128-bit one and the one-block tail (NEON's four-block
 * loop on AArch64).
 *
 * Measured **3,771 bytes** on 2026-11-03 with clang 18.1.3 on linux-x64, all of it
 * `.text`: the kernel with its two unrolled vector loops and its tail 3,608, the
 * resolver 163; the rotate masks are `.rodata`. Its own translation unit rather than
 * more of `runtime-aes.c`: a program that speaks AES-GCM carries no ChaCha20, and the
 * rule is a new file with its own measured ceiling, never a raised one. The budget is
 * the next 256-byte boundary above the measurement, as every ceiling here was set.
 */
const RUNTIME_CHACHA20_TEXT_BUDGET = 3840
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-checksum.c`
 * -- CRC-32 on the CPU's carry-less multiply (WP38 CRC): `nish_crc32_hw`, its CPUID
 * question and `NISH_CRC32` pin, and the PCLMULQDQ folding kernel; and Adler-32 on
 * SSSE3 (WP38 S8): `nish_adler32_hw`, its pin `NISH_ADLER32`, and the kernel.
 *
 * Measured **718 bytes** on 2026-10-30 with clang 18.1.3 on linux-x64, all of it
 * `.text`: the folding kernel with its Barrett reduction 514, the nibble-table tail
 * 58, the resolver 121 and the entry point 25. A translation unit of its own rather
 * than more of `runtime-aes.c`, which shares only the instruction: apart, a program
 * that checks a gzip trailer carries no AES and one that speaks TLS no CRC. The
 * AArch64 build is the CRC32 instructions and is smaller; the ceiling is measured
 * where the gate runs. The budget is the next 256-byte boundary above the
 * measurement, as every ceiling here was set.
 *
 * Raised to 1,280 on 2026-11-11 by Adler-32 on SSSE3 (WP38 S8), measured **1,153
 * bytes**: the SSSE3 kernel with its scalar tail inlined 297, `nish_adler32_hw` with
 * its CPUID question and `NISH_ADLER32` pin 113, and the entry point 22. Raised in
 * place rather than split into a file of its own because both checksums are the
 * same seam over the same `nish_array` window, and a program that inflates zlib or
 * gzip already links this unit. The gate measures the x86-64 build only: the test
 * shards run on x86-64, and the AArch64 CI job runs the kernel sections, not this
 * one. The AArch64 build, NEON Adler-32 and the CRC32 instructions, measured **752
 * bytes** (`--target=aarch64-linux-gnu -ffreestanding`, clang 18), under the ceiling.
 */
const RUNTIME_CHECKSUM_TEXT_BUDGET = 1280
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-term.c`
 * -- the terminal half, `nish:term`: `readStdin`, `waitStdin`, `isTerminal`,
 * `terminalSize`, `setRawMode` and `setTerminalRestore`, with the restore that the
 * exit, a panic and every signal whose default ends the program run while raw
 * mode holds or restore bytes wait, and the SIGTSTP handler that gives the
 * terminal back on Ctrl-Z and raw mode on `fg`.
 *
 * Raised to 2,048 on 2026-10-24 by `setTerminalRestore`, measured **1,825 bytes**:
 * `nish_set_terminal_restore` 238, `nish_term_finish` 94 (the one `write` loop of
 * the bytes, inlined into it), the handlers' setup split out of `setRawMode` as
 * `nish_term_arm` for both callers (+16), the restore's keeping the panic hook
 * while bytes wait (+10), and every signal blocked while the bytes go out, in the
 * ending handlers' mask and around the atexit and panic write (+48). Raised in place rather than split into a file of its
 * own because the bytes go out from this file's static handlers, under its lock.
 *
 * Measured **1,419 bytes** on 2026-10-23 with clang 18.1.3 on linux-x64, all of it
 * `.text`, 333 of them the SIGTSTP handler and the lock it shares with
 * `setRawMode` (`nish_term_on_signal`, `_mask`, `_hold`, `_drop` and `_leave`),
 * and 261 `nish_stdin_ready`, whose `select` a caught Ctrl-Z interrupts and
 * which then asks again for what is left of a monotonic deadline (100 of them).
 * The clock is `runtime-os.c`'s `nish_monotonic_nanos` (36 bytes), which a
 * program that waits links from there and this ceiling does not count.
 * A ninth translation unit rather than more of `runtime-os.c`, which had 177
 * bytes of its ceiling left, because the rule is a new file with its own
 * measured ceiling, never a raised one. The budget is the next 256-byte boundary
 * above the measurement, as every ceiling here was set.
 */
const RUNTIME_TERM_TEXT_BUDGET = 2048
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-bytes.c`
 * -- the byte-class runs of `nish/bytes` (WP38 S6a): `nish_bytes_skip_blank`,
 * `nish_bytes_skip_digits`, `nish_bytes_skip_json_text` and `nish_bytes_skip_json_plain`,
 * their scalar, SSE2 and AVX2 paths, the UTF-8 step the JSON text class takes, and the
 * resolver with its CPUID question and `NISH_SIMD` pin.
 *
 * Measured **1,891 bytes** on 2026-11-14 with clang 18.1.3 on linux-x64, all of it
 * `.text`: the scalar path 137, the SSE2 path 735, the AVX2 path 290, the UTF-8 step
 * 238, the plain class's scalar path 49 and SSE2 path 110, the resolver 249 and the
 * four entry points 83. It was 1,525 before the SSE2 path checked a text block's
 * UTF-8 whole (+366: the SSE2 path 265 to 735 with the check, the cut-sequence
 * back-off and the resume, 26, now inlined into it; the AVX2 path 368 to 290, which
 * hands text past a high byte to the SSE2 path, 62 of it the out-of-line hand-off
 * that takes the run back once a block is ASCII again), for 116 to 67 Ir a JSON text
 * run on twitter.json, 8.1% of the document's tokenize Ir
 * (docs/wp7-runtime.md). It was 1,303 with three classes; the
 * fourth, the writer's plain bytes, added 222: its own paths 159, its entry point 21
 * and the resolver's second pointer 45 (the resolver 204 to 249), less 3 from the
 * UTF-8 resume (29 to 26, layout). The three class paths' instructions are as they
 * were. A tenth
 * translation unit rather than more of `runtime-simd.c`: folded in, the two measured
 * 1,960 bytes against that file's ceiling of 768, and the rule is a new file with its
 * own measured ceiling, never a raised one. Apart, a program that searches text carries
 * no JSON run and one that tokenizes JSON no byte-set search. The budget is the next
 * 256-byte boundary above the measurement, as every ceiling here was set.
 */
const RUNTIME_BYTES_TEXT_BUDGET = 2048
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-sandbox.c`
 * -- the confinement `--sandbox` applies (WP37, docs/security/sandbox.md):
 * `nish_sandbox`, which a sandboxed program's `.preinit_array` calls, and
 * `nish_sandbox_check`, which its `main` calls first, with the capability drop, the
 * Landlock ruleset and the seccomp filter they build.
 *
 * Measured **2,264 bytes** on 2026-10-24 with clang 18.1.3 on linux-x64. An eleventh
 * translation unit rather than more of `runtime-os.c`, so a program built without
 * `--sandbox` links none of it: the linker drops the object nothing references. The
 * budget is the next 256-byte boundary above the measurement, as every ceiling here was
 * set.
 *
 * Raised to 2,560, the next 256-byte boundary, for the `fs.read=<dir>` and
 * `fs.write=<dir>` scopes (WP37 stage 2): one Landlock rule per scope directory, the
 * strict refusal and best-effort line for a directory gone since the build, and the
 * metadata rows kept for a scoped write. Measured 2,545 against 2,264 before it on
 * 2026-10-30 with clang 18 on linux-x64. Only a sandboxed build links any of it.
 *
 * Raised to 3,328, the next 256-byte boundary, for SBX-1 (WP37): the identities of
 * the interpreters the exec allowlist marks, and the spawn-target check that
 * resolves a spawn's program as `posix_spawnp` would and refuses one of them.
 * Measured 3,143 against 2,558 before it on 2026-11-11 with clang 18.1.3 on
 * linux-x64. Here rather than in `runtime-os.c`, whose spawn reaches it through a
 * pointer only `nish_sandbox` sets, so a build without `--sandbox` links none of it.
 *
 * Raised to 4,096, the next 256-byte boundary, for SBX-1's second part (WP37): the
 * one exec a spawn under an exec allowlist is held to, which is two threads, a
 * seccomp filter with a user-notification listener and the loop that answers it.
 * Measured 4,067 against 3,143 before it on 2026-11-12 with clang 18.1.3 on
 * linux-x64; `runtime-os.c` gave back 30 bytes (5,761 from 5,791), its spawn now
 * handed over whole.
 *
 * Raised to 4,352, the next 256-byte boundary, the same day: a spawn whose exec the
 * supervisor cannot answer "continue" has its exec failed, or the child killed and
 * reaped, so that the spawn answers its refusal. Measured 4,199 against 4,067.
 *
 * Raised to 4,608, the next 256-byte boundary, the same day: both threads of a spawn
 * run with every signal blocked and the child is given the calling thread's mask
 * through spawn attributes, and a thread that cannot be started prints the refusal
 * line. Measured 4,409 against 4,199, leaving 199.
 *
 * Unchanged for `process.spawn=exec:<program>` (WP40 §2a): the marked identities
 * carry which kind each is, and a spawn of a program granted `exec:` is started by
 * the supervisor itself, without the filter, through the `posix_spawn` call the
 * spawner now shares. Measured 4,507 against 4,409 on 2026-11-13 with clang 18.1.3
 * on linux-x64. The ceiling stands, leaving 101.
 */
const RUNTIME_SANDBOX_TEXT_BUDGET = 4608
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-shm.c`
 * -- the shared-memory regions of `nish/sync/shm` and `nish/sync/ring`
 * (docs/wp47-shared-memory.md, docs/security/shm.md): the handle table, the create,
 * open, unlink and close of a named region, the 32- and 64-bit slot accesses with
 * their bounds, alignment and ordering checks, the byte copies, the futex wait and
 * wake, and the panic text they build.
 *
 * Measured **2,539 bytes** on 2026-10-30 with clang 18.1.3 on linux-x64 (2,576 with
 * `-DNISH_THREADS=1`, where the table is thread-local; the ceiling holds both). A
 * fourteenth translation unit rather than more of `runtime-os.c`, so a program that
 * imports neither module links none of it: the linker drops the object nothing
 * references. The budget is the next 256-byte boundary above the measurement, as
 * every ceiling here was set. It measured **2,964 bytes** (2,988 thread-local) on
 * 2026-11-06 with clang 18.1.3 on linux-x64 once the windows of `SharedRegion.lend`
 * were added (2,816 to 3,072): `nishshm_lend` 180, `nishshm_give_back` 112 and the
 * loop in `nishshm_close` that empties every window before the unmap. They stay
 * here rather than in a file of their own because `close` must reach them.
 */
const RUNTIME_SHM_TEXT_BUDGET = 3072
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-region.c`
 * -- the regions of docs/wp46-long-running-memory.md (stage 1, the runtime): the handle
 * table, `nish_region_new`, `_enter`, `_leave` and `_free` with their zero, stale,
 * thread and entered checks, and the panic table (docs/security/runtime.md).
 *
 * Measured **664 bytes** on 2026-11-01 with clang 18.1.3 on linux-x64. A fifteenth
 * translation unit, so a program that makes no region links none of it. The budget is
 * the next 256-byte boundary above the measurement.
 *
 * Raised to 1,024 by ASYNC-15 (docs/security/async.md): `nish_region_adopt` carves what
 * the caller's chunk had left into a chunk above the region's, so a loop that never
 * releases keeps its lanes' bytes rather than a chunk per lane. Measured **850 bytes**
 * against 766 on 2026-11-09 with clang 18.1.3 on linux-x64; the next 256-byte boundary.
 * Raised to 1,536 by parent/child regions (RT-48, docs/security/runtime.md): each slot
 * links its parent and children, `free` cascades deepest first and unlinks, and adopt
 * refuses a region in a tree. Measured **1,486 bytes** against 850 on 2026-11-10 with
 * clang 18.1.3 on linux-x64; the next 256-byte boundary.
 */
const RUNTIME_REGION_TEXT_BUDGET = 1536
/**
 * The same file with `-DNISH_THREADS=1`: the table's spin lock, the thread number taken
 * from a process-wide counter, and the innermost entered handle, which is thread-local.
 * Measured **852 bytes** on 2026-11-01 with clang 18.1.3 on linux-x64; a row of its own,
 * as `runtime.c`'s threads build has, so neither number covers the other's room.
 * Raised to 1,280 by ASYNC-15's carve (as above): measured **1,099 bytes** against 994 on
 * 2026-11-09 with clang 18.1.3 on linux-x64; the next 256-byte boundary.
 * Raised to 1,792 by parent/child regions (as above): measured **1,733 bytes** against
 * 1,099 on 2026-11-10 with clang 18.1.3 on linux-x64; the next 256-byte boundary.
 */
const RUNTIME_REGION_THREADS_TEXT_BUDGET = 1792

/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-async.c`
 * -- the executor of docs/wp49-async-server.md (stage 5, part 1): the node slabs, one per
 * spawned kind, the epoll (kqueue on Darwin) set with its `(task, generation)` entries,
 * the binary-heap timer list, `nish_async_next`'s one blocking wait, and the copy of a
 * spawned `string` into the task's region (docs/security/async.md).
 *
 * Measured **2,596 bytes** on 2026-11-07 with clang 18.1.3 on linux-x64, the same with
 * `-DNISH_THREADS=1`: the executor runs on the thread that called `main` and keeps no
 * thread-local state, so it has one row. A sixteenth translation unit, linked only into a
 * program whose IR declares a `nish_async_*` function (scripts/build.sh), so a program
 * that never awaits a wait or spawns carries none of it. The budget is the next 256-byte
 * boundary above the measurement.
 *
 * Raised to 3,840 by cancellation (stage 5, part 7): a task's cancel flag and the list of
 * its pending waits, a bounded descriptor wait's deadline timer, `cancelAfter`'s timer,
 * and taking a task off the ready queue when it finishes queued (ASYNC-18). Measured
 * **3,797 bytes** against 2,627 on 2026-11-09 with clang 18.1.3 on linux-x64; the next
 * 256-byte boundary.
 *
 * Raised to 4,096 by recycling (stage 6, ASYNC-20): `nish_async_done` rewinds a finished
 * task's region and the node keeps it, with the per-chunk and total bounds on what is
 * kept and the count of kept bytes, in place of `nish_region_free` and a new region per
 * spawn. Measured **3,910 bytes** against 3,797 on 2026-11-12 with clang 18.1.3 on
 * linux-x64 (3,921 with `-DNISH_THREADS=1`, where the arena it rewinds is thread-local);
 * the next 256-byte boundary. `runtime-region.c` did not move.
 */
const RUNTIME_ASYNC_TEXT_BUDGET = 4096

/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/sqlite/nish-sqlite.c`
 * -- the adapter `nish/sqlite` calls: the thread-local connection and statement tables
 * that turn SQLite's pointers into `i32` handles, and the `nishsqlite_*` entry points
 * over them (open, close, exec, prepare, step, reset, bind, column reads and the copy of
 * a column into a caller's buffer). SQLite itself, `sqlite3.c`, is not counted: it is
 * vendored, linked only into a program that imports `nish/sqlite`, and its size is
 * upstream's.
 *
 * Measured **1,831 bytes** on 2026-10-24 with clang 18.1.3 on linux-x64, all of it
 * `.text`. Its own translation unit, linked only with SQLite, so a program that does not
 * import the module carries none of it. The budget is the next 256-byte boundary above
 * the measurement, as every ceiling here was set.
 */
const RUNTIME_SQLITE_TEXT_BUDGET = 2048

/**
 * Ceiling on what `new Http1Server(config, listener, 16384)` takes from the arena
 * before its first connection -- not a `.text` budget, so not a row of
 * `RUNTIME_BUDGETS`: `tests/run.js` links `tests/link/net_http1_server/startup.ts`,
 * which builds that pool on the default `Http1Config` and prints the bytes.
 *
 * Measured **16,688 bytes** on 2026-10-20 with clang 18 on linux-x64: the 16,384-byte
 * read scratch every server keeps, and the pool's own bookkeeping, with no slot's
 * connection built. Each connection is built on the first accept into its slot,
 * 752 bytes on the same defaults (2026-11-13). Built eagerly, as every slot was before, a
 * 16,384-slot server was 65.3 MB resident at start-up against 2.6 MB now, and peaked
 * at 65 MB against 4 MB under keep-alive c=500 (`bench/README.md`). The budget is the
 * next 256-byte boundary above the measurement, as every ceiling here was set.
 */
export const HTTP1_SERVER_START_BYTES = 16896

/**
 * Ceiling on what one idle keep-alive `Http1Server` connection holds in the arena on
 * the default `Http1Config` -- not a `.text` budget: `tests/run.js` links
 * `tests/link/net_http1_server/startup.ts`, which builds a connection as the server
 * builds a slot's, on its outputs, input and head pools and shared `Date`, serves it
 * four GETs, parks it and prints the bytes, after a first connection has served the
 * same so that what the pools keep for every connection is not counted.
 *
 * Measured **904 bytes** on 2026-11-13 with clang 18 on linux-x64, against 3,384
 * on the base before the idle trims: a built connection no longer allocates a
 * `Date` it drops or spans and fields it replaces on the first request, the head
 * it keeps to write again is sized to that head, not `H1_HEAD_KEEP`'s 1 KB, and
 * `Http1Config.idleInput`, now on by default, lends its input and head buffers to
 * the pools while it rests (2,232 bytes with it off). The budget is the next
 * 256-byte boundary above the measurement, as every ceiling here was set.
 */
export const HTTP1_SERVER_IDLE_BYTES = 1024

/**
 * Ceiling on what `new TlsTcpServer(config, listener, 16384)` takes from the arena
 * before its first connection -- not a `.text` budget: `tests/run.js` links
 * `tests/link/net_tls_record_tcp/startup.ts`, which builds that pool on the test
 * configuration and prints the bytes.
 *
 * Measured **41,640 bytes** on 2026-10-20 with clang 18 on linux-x64: the
 * record-sized read scratch, the P-256 signer and the empty record pools, with no
 * slot's handshake state or server random built. Each slot's are built on the first
 * accept into it. Built eagerly, as every slot was before, the interop server's
 * HTTP/2 pool on 1,024 slots was 78.2 MB resident at listening against 27.8 MB now
 * (`bench/pool-rss.mjs --per-pool`, three runs each, base and head each against a
 * byte-identical copy of itself within 0.1 MB). The budget is the next 256-byte
 * boundary above the measurement: the 88 bytes of headroom are intended, and a slot
 * built eagerly again costs far more than they hold.
 */
export const TLS_TCP_START_BYTES = 41728

/**
 * Ceiling on what `new Http1TlsServer(tlsConfig, config, listener, 16384)` takes from
 * the arena before its first connection, linked by `tests/run.js` from
 * `tests/link/net_http1_server/tls-startup.ts` on the default `Http1Config`.
 *
 * Measured **58,384 bytes** on 2026-10-25 with clang 18 on linux-x64:
 * `TLS_TCP_START_BYTES`'s pool and the HTTP/1.1 read scratch, `Date` and empty output
 * pool, and the two empty pools `Http1Config.idleInput` lends input and head buffers
 * to (88 bytes, against 58,296 before them), with no slot's connection built. Built eagerly, a 1,024-slot pool was 31.2 MB
 * resident at listening against 4.6 MB now, and 18.1 MB against 4.6 MB at 256 slots
 * (measured as `TLS_TCP_START_BYTES` says). The budget is the next 256-byte boundary
 * above the measurement: the 240 bytes of headroom are intended, and one slot's
 * connection built eagerly again costs far more than they hold.
 */
export const HTTP1_TLS_SERVER_START_BYTES = 58624

/**
 * Ceiling on what `new Http3Server(quicConfig, config, fd, 65536, entropy)` takes from
 * the arena before its first connection -- not a `.text` budget, so not a row of
 * `RUNTIME_BUDGETS`: `tests/run.js` links `tests/link/net_http3_server/startup.ts`,
 * which builds that pool, the most slots a server takes, on the test configuration
 * and prints the bytes.
 *
 * Measured **17,501,520 bytes** on 2026-10-20 with clang 18 on linux-x64, about 267
 * bytes a slot: the fixed per-slot tables, some 232 bytes a slot (the connection ID
 * index 184, the timer wheel 20, the signature, state, ready, dirty, queued and free
 * tables 28), and the 64 KB receive buffer, the transmit scratch and the pools' own
 * bookkeeping, with no slot's connections built. Each slot's QUIC and HTTP/3
 * connections and address are built on the first Initial accepted into it, which
 * `HTTP3_SERVER_SLOT_BYTES` pins. The budget is the next 256-byte boundary above the
 * measurement, as every ceiling here was set.
 */
export const HTTP3_SERVER_START_BYTES = 17501696

/**
 * What one `Http3Server` slot's QUIC and HTTP/3 connections and address take from
 * the arena when they are built: the second figure
 * `tests/link/net_http3_server/startup.ts` prints, the slot `connection(0)` builds
 * on the test configuration. `tests/run.js` holds it to this exactly, not under a
 * ceiling: the arena's count is deterministic (five runs gave the same figure), so a
 * slot that costs a byte more or less fails, and this is moved with the change that
 * moved it.
 *
 * Measured **111,688 bytes** on 2026-10-22 with clang 18 on linux-x64. #474's ECN
 * state added 120 of them: the four ECN counts of each of the three packet-number
 * spaces (96), recovery's ECN state and the connection's `ecnMarking` and
 * `datagramEcn` (24 with padding). Whether a packet was marked rides in its state
 * byte, so the sent-packet rings grew by nothing.
 *
 * Moved to **110,536 bytes** (-1,152) when array fields of unknown length became
 * boxed: such a field holds its `len` and `data` in the object, so the 24-byte
 * header each one used to allocate is gone (`docs/LANGUAGE.md`, "Fixed-length
 * array fields are stored inline").
 *
 * Moved to **110,920 bytes** (+384) by path validation (RFC 9000 §9): the six
 * arrays a `QuicConnection` keeps for its current, validated, arriving and probed
 * addresses, the PATH_RESPONSE it owes on another path and its last three
 * PATH_CHALLENGEs, with their headers.
 *
 * Moved to **110,912 bytes** (-8) when `QuicConnection`'s path and ECN fields
 * were declared widest first, which took out the padding the path fields had
 * added to the object (NL9010).
 *
 * Moved to **110,976 bytes** (+64) by path MTU discovery (RFC 9000 §14.3): the
 * connection's path MTU, its limit, the search's bounds, the probe in flight and
 * its counters, and recovery's datagram size.
 *
 * Moved to **110,984 bytes** (+8) by #1485's early probe: the connection's
 * `earlyProbeAcked`, the largest acknowledged packet its last early probe was
 * asked at, so that one probe goes per acknowledgement.
 *
 * Moved to **111,008 bytes** (+24) by the HTTP/3 clock (H3-5,
 * `docs/security/http3.md`): the two times an `Http3Connection` measures its
 * idle and head timeouts from, and the counts and mode that say whether a
 * client made progress, filling padding the object already had.
 *
 * Moved to **111,016 bytes** (+8) by the reset budget (H3-9,
 * `docs/security/http3.md`): the `resetCredit` an `Http3Connection` charges each
 * request reset against, which the clock's fields had left no padding for.
 */
export const HTTP3_SERVER_SLOT_BYTES = 111016

/**
 * Ceiling on what `new Http2TlsServer(tlsConfig, config, listener, 16384)` takes from
 * the arena before its first connection, linked by `tests/run.js` from
 * `tests/link/net_http2_tls/startup.ts` on the default `Http2Config`.
 *
 * Measured **58,560 bytes** on 2026-10-21 with clang 18 on linux-x64:
 * `TLS_TCP_START_BYTES`'s pool, the shared `Http2Pools` and `HttpDate`, and slot 0's
 * connection, which the constructor still builds so that a bad `Http2Config` is
 * refused there; every other slot's is built on the first accept into it. Built
 * eagerly, as at `c8a00d6`, the interop server's HTTP/2 pool on 1,024 slots was 27.7 MB
 * resident at listening with the lazy TLS pool against 11.7 MB now, 23 kB a slot
 * against 7 kB (`bench/pool-rss.mjs --per-pool`, three interleaved rounds of three
 * runs, head against a byte-identical copy of itself within 0.1 MB). The budget is
 * the next 256-byte boundary above the measurement: the 64 bytes of headroom are
 * intended, and one more slot's connection built eagerly costs far more than they hold.
 */
export const HTTP2_TLS_SERVER_START_BYTES = 58624

/**
 * Every unit and configuration the gate measures: the source compiled with
 * `clang -Oz <flags> -c`, the ceiling on the sum of its `.text*` sections, and the
 * name of the constant that holds the ceiling, which a failure tells the reader to
 * raise.
 */
export const RUNTIME_BUDGETS = [
  ["runtime/runtime.c", RUNTIME_TEXT_BUDGET, "RUNTIME_TEXT_BUDGET", []],
  ["runtime/runtime-text.c", RUNTIME_TEXT_UNIT_BUDGET, "RUNTIME_TEXT_UNIT_BUDGET", []],
  ["runtime/runtime-os.c", RUNTIME_OS_TEXT_BUDGET, "RUNTIME_OS_TEXT_BUDGET", []],
  ["runtime/runtime.c", RUNTIME_THREADS_TEXT_BUDGET, "RUNTIME_THREADS_TEXT_BUDGET", ["-DNISH_THREADS=1"]],
  ["runtime/runtime-parallel.c", RUNTIME_PARALLEL_TEXT_BUDGET, "RUNTIME_PARALLEL_TEXT_BUDGET", []],
  [
    "runtime/runtime-parallel.c",
    RUNTIME_PARALLEL_THREADS_TEXT_BUDGET,
    "RUNTIME_PARALLEL_THREADS_TEXT_BUDGET",
    ["-DNISH_THREADS=1"],
  ],
  ["runtime/runtime-cross.c", RUNTIME_CROSS_TEXT_BUDGET, "RUNTIME_CROSS_TEXT_BUDGET", []],
  [
    "runtime/runtime-cross.c",
    RUNTIME_CROSS_THREADS_TEXT_BUDGET,
    "RUNTIME_CROSS_THREADS_TEXT_BUDGET",
    ["-DNISH_THREADS=1"],
  ],
  ["runtime/runtime-host.c", RUNTIME_HOST_TEXT_BUDGET, "RUNTIME_HOST_TEXT_BUDGET", []],
  ["runtime/runtime-net.c", NET_TEXT_BUDGET, "NET_TEXT_BUDGET", []],
  ["runtime/runtime-simd.c", RUNTIME_SIMD_TEXT_BUDGET, "RUNTIME_SIMD_TEXT_BUDGET", []],
  ["runtime/runtime-aes.c", RUNTIME_AES_TEXT_BUDGET, "RUNTIME_AES_TEXT_BUDGET", []],
  ["runtime/runtime-sha256.c", RUNTIME_SHA256_TEXT_BUDGET, "RUNTIME_SHA256_TEXT_BUDGET", []],
  ["runtime/runtime-chacha20.c", RUNTIME_CHACHA20_TEXT_BUDGET, "RUNTIME_CHACHA20_TEXT_BUDGET", []],
  ["runtime/runtime-checksum.c", RUNTIME_CHECKSUM_TEXT_BUDGET, "RUNTIME_CHECKSUM_TEXT_BUDGET", []],
  ["runtime/runtime-term.c", RUNTIME_TERM_TEXT_BUDGET, "RUNTIME_TERM_TEXT_BUDGET", []],
  ["runtime/runtime-bytes.c", RUNTIME_BYTES_TEXT_BUDGET, "RUNTIME_BYTES_TEXT_BUDGET", []],
  ["runtime/runtime-sandbox.c", RUNTIME_SANDBOX_TEXT_BUDGET, "RUNTIME_SANDBOX_TEXT_BUDGET", []],
  ["runtime/runtime-shm.c", RUNTIME_SHM_TEXT_BUDGET, "RUNTIME_SHM_TEXT_BUDGET", []],
  ["runtime/runtime-shm.c", RUNTIME_SHM_TEXT_BUDGET, "RUNTIME_SHM_TEXT_BUDGET", ["-DNISH_THREADS=1"]],
  ["runtime/runtime-region.c", RUNTIME_REGION_TEXT_BUDGET, "RUNTIME_REGION_TEXT_BUDGET", []],
  [
    "runtime/runtime-region.c",
    RUNTIME_REGION_THREADS_TEXT_BUDGET,
    "RUNTIME_REGION_THREADS_TEXT_BUDGET",
    ["-DNISH_THREADS=1"],
  ],
  ["runtime/runtime-async.c", RUNTIME_ASYNC_TEXT_BUDGET, "RUNTIME_ASYNC_TEXT_BUDGET", []],
  ["runtime/sqlite/nish-sqlite.c", RUNTIME_SQLITE_TEXT_BUDGET, "RUNTIME_SQLITE_TEXT_BUDGET", []],
].map(([src, budget, constant, flags]) => ({ src, budget, constant, flags }))

/**
 * The page's bytes under `--profile wasm-host` (WP50 stage 1, docs/wp50-wasm-host.md):
 * for each example, the ceilings on the three files a page ships -- the `.wasm`, the
 * `--emit-dts` loader and the `--inline` module -- raw, after `gzip -9` and after
 * brotli (Node's zlib at its defaults), as `[raw, gzip, brotli]`. The `wasm-size`
 * block of tests/run.js builds each and holds it to every ceiling.
 *
 * Measured 2026-11-07 with clang 18 on linux-x64 and no wasm-opt; each ceiling is the
 * measurement, so any growth is a decision recorded here with its own figures. Against
 * `--profile wasm`, the explicit export list takes add.wasm from 316 to 102 bytes (gzip
 * 233 to 111, brotli 211 to 87) and arrays.wasm, linked with runtime-wasm.c, from 2,827
 * to 2,091 (gzip 1,479 to 1,092, brotli 1,302 to 970).
 *
 * The ceilings are of that build, whatever is installed: the block links with
 * NISH_WASM_OPT=0 and a stand-in wasm-opt first on PATH, and fails if it ran. A wasm-opt
 * does not always shrink the module (#1257): clang 18 runs one itself after the link
 * and keeps the `target_features` section for it, which took add.wasm to 150 bytes.
 * build.sh's own pass drops that section again; with binaryen 132 it gives add.wasm
 * 74 / 93 / 68, arrays.wasm 1,713 / 970 / 876, results.wasm 72 / 90 / 69 and label.wasm
 * 12,464 / 11,710 / 11,207, which these ceilings do not pin.
 *
 * label.ts is the string row (WP50 stage 4, measured 2026-11-08): a template with an
 * `i32` and an `f64` links runtime-text.c beside runtime-wasm.c. Of its 13,046 bytes,
 * 10,296 are the shortest-f64 printer's power-of-ten table (the data section) and the
 * code is 2,502; the same template with only the `i32` links to 1,111 bytes, because
 * `--gc-sections` drops the printer and its table. Its loader is 3,556 bytes (gzip
 * 1,483, brotli 1,302): 28 of them the `ignoreBOM` option that keeps a leading U+FEFF.
 *
 * examples/wasm-arena/client.ts is the whole-page row (WP50 stage 6, measured
 * 2026-11-10): client.ts, sim.ts and nish/host/ring compiled with `--host
 * examples/wasm-arena/host.ts --memory 4` (the page's own build), one `.ll` each,
 * linked with no runtime-wasm.c. Its 14,108-byte `.wasm` (gzip 6,356, brotli 5,814;
 * one byte and 66 brotli bytes over the build without `--memory`) is the whole
 * simulation, the renderer's instance packing and the input ring; its loader is
 * 10,767 bytes (gzip 3,522, brotli 3,090), most of it the eight module-storage
 * views and the two host imports that take a string.
 */
export const WASM_HOST_SIZE_BUDGETS = [
  {
    src: "examples/add.ts",
    runtime: false,
    wasm: [102, 111, 87],
    loader: [1625, 732, 625],
    inline: [396, 253, 223],
  },
  {
    src: "examples/arrays.ts",
    runtime: true,
    wasm: [2091, 1092, 970],
    loader: [4560, 1602, 1399],
    inline: [6163, 1468, 1267],
  },
  {
    src: "examples/results.ts",
    runtime: false,
    wasm: [82, 99, 76],
    loader: [2508, 1082, 943],
    inline: [339, 234, 197],
  },
  {
    src: "examples/label.ts",
    runtime: true,
    wasm: [13046, 11786, 11297],
    loader: [3556, 1483, 1302],
    inline: [44371, 15639, 13682],
  },
  {
    src: "examples/wasm-arena/client.ts",
    host: "examples/wasm-arena/host.ts",
    memory: 4,
    runtime: false,
    wasm: [14108, 6356, 5814],
    loader: [10767, 3522, 3090],
    inline: [42249, 7821, 6770],
  },
]

/**
 * What a program that uses no stage-2 or stage-3 feature gets is what it got before
 * them (WP50 stage 3, docs/wp50-wasm-host.md §6): the sha-256 of the `--emit-dts`
 * `.d.ts` and loader, and of the `.wasm` linked by `--profile wasm` and by
 * `--profile wasm-host`, for each example. Only a program with module storage or a
 * host module gets the guarded loader and the `nish.panic` import; results.ts pins the
 * plain `{ ok, value }` packing a `Result` parameter gets. Taken from the
 * 0.36.0 compiler and main's scripts/build.sh and runtime-wasm.c, with clang 18
 * on linux-x64 and no wasm-opt; the `wasm-size` block of tests/run.js holds
 * every build to them. A change that moves one is a change to every plain program's
 * bytes: it updates the digest here and says why in its commit.
 *
 * WP44 stage "files" moved the `--profile wasm` digest of arrays.ts and label.ts
 * (105 bytes raw each; `--profile wasm-host`, the `.d.ts` and the loader are
 * unchanged). runtime-wasm.c defines nish_file_open, nish_file_read_at,
 * nish_file_size and nish_file_close, each answering -38, so a program that calls
 * them still links on freestanding wasm (docs/wp44-streaming-files.md §9 Q7). That profile
 * links with `--export-all`, which exports every defined symbol whatever its
 * visibility, and an exported symbol survives `--gc-sections`, so the four stubs
 * are in every module that links runtime-wasm.c. Keeping them out of a program
 * that never calls them is a change to scripts/build.sh's link line.
 *
 * The game-page stage moved the same two digests again, for the same reason:
 * runtime-wasm.c defines nish_arena_keep, the call-site reclaim's keep, as the
 * identity, so string code reached from wasm (nish/term) links
 * (docs/wp6-memory.md §2a), and `--export-all` keeps it in every module.
 */
export const WASM_PLAIN_DIGESTS = [
  {
    src: "examples/add.ts",
    dts: "a778903f14bc84f10b073b3596be86f4afee5b2f6ef357f0259fd4398b506d2c",
    loader: "8ff7c215c5a084df79f7bc3d88b82d0137422cddeb1bbea8bb958890c8cc792a",
    wasm: "6440497d7438b6f38e8adbc6f31fa1b265825fde3f85e02fc253e4ddc5eeccdc",
    host: "a57f2f52343518d5d351f91d2a7d40fa6281a20fb8b3be7d116d14e8db6daae6",
  },
  {
    src: "examples/arrays.ts",
    dts: "e01467ab59357645168a86b4defe2aa137a0c2395e1b211993379957899154b7",
    loader: "894b7789a0be7f7fb39bdcd252d58dd321e6912cb425db7e459f0cbc11c2500a",
    wasm: "bb48e976a4bf87d39260add7b57da65f45387a1b822e144d902ae94417a4b004",
    host: "93a7dc1238aa9f6548de14593dd1fe0f99b6b732a5e2ec5b31543799ab5dd548",
  },
  {
    src: "examples/results.ts",
    dts: "44fe9b7f259835e31570e83ddf00a31462e83032e733f378b75d6936ed2ca542",
    loader: "700569e5007824aafbe0d99b42639db6f2280b65488a575edeb21d26da05aee6",
    wasm: "5040e616dfcf06673d5de62b5926e840734aaf550d2c0e1d8d7b1d1319c211a3",
    host: "4a93551c63373e264d34dd074f3f1e9da4a1ff10b8ed0225087bc7b24e9c0c22",
  },
  {
    // WP50 stage 4: new with the string bridge, so its bytes have no earlier build to match;
    // its .d.ts carries the string header, which a program with no string in a signature does not.
    src: "examples/label.ts",
    dts: "2908a99c7f6fbfdb2f974459751e1ef424fc31651f3d90905199af43572f7458",
    loader: "8c8c983e487e7fce8d39053ce902bf0ad83851e4263f5f177de7438bb25c755b",
    wasm: "ea55629e5d04c0ce90835fc3879b71844a78cfc5a9ca2805b813292c602da76f",
    host: "ef8d59319dfcc282e9db6017e616dc07c6c65c913f388d00bdc9e0fe83a0b65f",
  },
]

/**
 * A row's name in a check and in the report: the file, and its flags when it has any,
 * so the two rows for `runtime.c` read as the two configurations they are rather than
 * as a repeat.
 */
export const budgetLabel = ({ src, flags }) => [src.replace(/^runtime\//, ""), ...flags].join(" ")

if (process.argv[1] === import.meta.filename) {
  for (const row of RUNTIME_BUDGETS) {
    process.stdout.write(
      `${[budgetLabel(row), row.src, row.budget, row.constant, row.flags.join(" ")].join("\t")}\n`
    )
  }
}
