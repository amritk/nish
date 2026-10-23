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
 */
const RUNTIME_TEXT_BUDGET = 3698
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
 */
const RUNTIME_OS_TEXT_BUDGET = 2560
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
 */
const RUNTIME_THREADS_TEXT_BUDGET = 3899
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
 */
const RUNTIME_PARALLEL_THREADS_TEXT_BUDGET = 2560
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
 * `tcpListenFlags`, `tcpAccept`, `netRead`, `netWrite`, `netShutdown` and `netClose`, then `udpBind`,
 * `udpSendTo` and `udpRecvFrom`, then the readiness loop: `pollCreate`, `pollAdd`,
 * `pollModify`, `pollRemove` and `pollWait`.
 *
 * Measured **853 bytes** on 2026-09-29 with clang 18 on linux-x64, all of it `.text`,
 * **1,782 bytes** on 2026-09-30 once UDP, its segmentation offload and its ECN
 * control messages were added (the ceiling went from 1,024 to 2,048), and
 * **2,071 bytes** the same day once the epoll loop was added (2,048 to 2,304), and
 * **2,335 bytes** on 2026-10-20 once `tcpListenFlags` and its `SO_REUSEPORT` were
 * added (2,304 to 2,560).
 * They are a fifth translation unit rather than more of `runtime-host.c` because the
 * surface grows -- UDP and the readiness loop were the second and third slices of N5,
 * and each raised this ceiling alone, with a fresh measurement in docs/wp7-runtime.md -- and
 * the rule is a new file with its own measured ceiling, never a raised one. The
 * budget is the next 256-byte boundary above the measurement, as every ceiling here
 * was set.
 */
const NET_TEXT_BUDGET = 2560
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-simd.c`
 * -- the byte searches that read a vector at a time (WP38 S1): `nish_str_index_of_any`,
 * its scalar, SSE2 and AVX2 paths, the CPU question and the resolver that picks one.
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
 */
const RUNTIME_SIMD_TEXT_BUDGET = 768
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
 */
const RUNTIME_AES_TEXT_BUDGET = 2560
/**
 * Ceiling on the sum of the `.text*` sections of `clang -Oz -c runtime/runtime-term.c`
 * -- the terminal half, `nish:term`: `readStdin`, `waitStdin`, `isTerminal`,
 * `terminalSize` and `setRawMode`, with the restore that the exit, a panic and
 * every signal whose default ends the program run while raw mode holds, and the
 * SIGTSTP handler that gives the terminal back on Ctrl-Z and raw mode on `fg`.
 *
 * Measured **1,316 bytes** on 2026-10-23 with clang 18.1.3 on linux-x64, all of it
 * `.text`, 332 of them the SIGTSTP handler and the lock it shares with
 * `setRawMode`. A ninth translation unit rather than more of `runtime-os.c`, which
 * had 177 bytes of its ceiling left, because the rule is a new file with its own
 * measured ceiling, never a raised one. The budget is the next 256-byte boundary above the
 * measurement, as every ceiling here was set.
 */
const RUNTIME_TERM_TEXT_BUDGET = 1536

/**
 * Ceiling on what `new Http1Server(config, listener, 16384)` takes from the arena
 * before its first connection -- not a `.text` budget, so not a row of
 * `RUNTIME_BUDGETS`: `tests/run.js` links `tests/link/net_http1_server/startup.ts`,
 * which builds that pool on the default `Http1Config` and prints the bytes.
 *
 * Measured **16,688 bytes** on 2026-10-20 with clang 18 on linux-x64: the 16,384-byte
 * read scratch every server keeps, and the pool's own bookkeeping, with no slot's
 * connection built. Each connection is built on the first accept into its slot,
 * 3,976 bytes on the same defaults. Built eagerly, as every slot was before, a
 * 16,384-slot server was 65.3 MB resident at start-up against 2.6 MB now, and peaked
 * at 65 MB against 4 MB under keep-alive c=500 (`bench/README.md`). The budget is the
 * next 256-byte boundary above the measurement, as every ceiling here was set.
 */
export const HTTP1_SERVER_START_BYTES = 16896

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
 * Measured **58,296 bytes** on 2026-10-20 with clang 18 on linux-x64:
 * `TLS_TCP_START_BYTES`'s pool and the HTTP/1.1 read scratch, `Date` and empty output
 * pool, with no slot's connection built. Built eagerly, a 1,024-slot pool was 31.2 MB
 * resident at listening against 4.6 MB now, and 18.1 MB against 4.6 MB at 256 slots
 * (measured as `TLS_TCP_START_BYTES` says). The budget is the next 256-byte boundary
 * above the measurement: the 72 bytes of headroom are intended, and one slot's
 * connection built eagerly again costs far more than they hold.
 */
export const HTTP1_TLS_SERVER_START_BYTES = 58368

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
 */
export const HTTP3_SERVER_SLOT_BYTES = 111688

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
  ["runtime/runtime-term.c", RUNTIME_TERM_TEXT_BUDGET, "RUNTIME_TERM_TEXT_BUDGET", []],
].map(([src, budget, constant, flags]) => ({ src, budget, constant, flags }))

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
