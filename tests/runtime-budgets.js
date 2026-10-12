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
 */
const RUNTIME_TEXT_BUDGET = 3622
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
 */
const RUNTIME_OS_TEXT_BUDGET = 1536
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
 */
const RUNTIME_THREADS_TEXT_BUDGET = 3840
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
 */
const RUNTIME_PARALLEL_THREADS_TEXT_BUDGET = 2816
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
 * `tcpAccept`, `netRead`, `netWrite`, `netShutdown` and `netClose`, then `udpBind`,
 * `udpSendTo` and `udpRecvFrom`, then the readiness loop: `pollCreate`, `pollAdd`,
 * `pollModify`, `pollRemove` and `pollWait`.
 *
 * Measured **853 bytes** on 2026-09-29 with clang 18 on linux-x64, all of it `.text`,
 * **1,782 bytes** on 2026-09-30 once UDP, its segmentation offload and its ECN
 * control messages were added (the ceiling went from 1,024 to 2,048), and
 * **2,071 bytes** the same day once the epoll loop was added (2,048 to 2,304).
 * They are a fifth translation unit rather than more of `runtime-host.c` because the
 * surface grows -- UDP and the readiness loop were the second and third slices of N5,
 * and each raised this ceiling alone, with a fresh measurement in docs/wp7-runtime.md -- and
 * the rule is a new file with its own measured ceiling, never a raised one. The
 * budget is the next 256-byte boundary above the measurement, as every ceiling here
 * was set.
 */
const NET_TEXT_BUDGET = 2304
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
  ["runtime/runtime-host.c", RUNTIME_HOST_TEXT_BUDGET, "RUNTIME_HOST_TEXT_BUDGET", []],
  ["runtime/runtime-net.c", NET_TEXT_BUDGET, "NET_TEXT_BUDGET", []],
  ["runtime/runtime-simd.c", RUNTIME_SIMD_TEXT_BUDGET, "RUNTIME_SIMD_TEXT_BUDGET", []],
  ["runtime/runtime-aes.c", RUNTIME_AES_TEXT_BUDGET, "RUNTIME_AES_TEXT_BUDGET", []],
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
