# Security record: the async executor

The record of the executor that runs `async` tasks: `runtime/runtime-async.c`,
which parks a task on a descriptor or a timer and wakes it when the kernel
says so, and the driver the compiler emits around it. What it reads from the
outside is the kernel's readiness report for descriptors the program chose,
and those descriptors are often a network peer's sockets, so a peer decides
when, and whether, a task is resumed. It says what each such input can do,
with the test that pins each answer. The design is
[`wp49-async-server.md`](../wp49-async-server.md),
"Stage 5, part 1". It was written on top of `main` at `ba85d3e`, in the change
that adds the executor, and names functions rather than lines, so it has no
`file:line` anchors to move.

**Result.** No completion can resume a task it was not made for: every wait
records the (index, generation) of the task that made it, and one that
arrives after that task finished is dropped and counted (ASYNC-1). A
descriptor wait registers a duplicate, so a program that closes and reuses a
descriptor number while a task waits cannot have the old registration answer
for the new file (ASYNC-4). A timer's deadline cannot overflow (ASYNC-3).
ASYNC-1 and ASYNC-2 are reached only by driving the runtime from C (the
`probe.c` of `tests/link/async_late_completion`): the emitted driver waits on
its own task's token and never holds one past that task, so Nish source has no
way to present a stale completion; the checks are defence in depth.
What remains is liveness: a peer that never makes its socket ready parks its
task for ever, and the loop with it (ASYNC-6, open), and readiness is a
hint, not a reservation (ASYNC-9, open), and a task that never
awaits holds the thread (ASYNC-5, decided). Nine findings (ASYNC-1 to
ASYNC-9): three fixed, three open, three decided.

## Scope

| File | What |
| --- | --- |
| `runtime/runtime-async.c` | the task slab and table (`nish_async_spawn`, `nish_async_done`, `nish_async_table_add`); the running task and its region (`nish_async_enter`, `nish_async_leave`); the waits and their tokens (`nish_async_wait_fd`, `nish_async_sleep`, `nish_async_poll`, `nish_async_slot_of`, `nish_async_fire`); the timer heap; the loop (`nish_async_block`, `nish_async_next`); `nish_async_copy_str` |
| `src/emit-async.ts` | the emitted driver, `@nish.async.run`, `@nish.async.drain` and `@nish.async.resume`, and each task's spawn, argument copies and await polls |

Out of scope: the region allocator a task's memory lives in
(`runtime/runtime-region.c`, `runtime.md`'s RT-41 to RT-47), and the
descriptors themselves, which the program opened through `nish:net` and which
`runtime.md` covers.

## Threat model

**Who is trusted.** The program's own code, the compiler that lowered it, and
the kernel.

**Who is the adversary.** A network peer at the far end of a socket a task
waits on. It controls when the socket becomes readable or writable, whether it
ever does, and when it is closed. Its aim is to make the executor resume the
wrong task, resume a task twice, read a frame that was given back, or stop
serving the program's other peers.

**What is not claimed.** The executor is cooperative and runs on the thread
that runs `main`: it does not preempt a task, and it does not bound how long
a task waits. A server that must not let one peer stall it gives each wait a
deadline of its own; cancellation, which would make that a library call, is a
later stage of WP49.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| ASYNC-1 | Medium | `runtime/runtime-async.c` (`nish_async_fire`, `nish_async_slot_of`) | A completion can arrive after the task that made its wait has finished: a timer of a task that returned, or a node that was given back and reused by a later spawn. Taken on trust, it would resume whatever task now holds the node, with an answer meant for another, and the resumed frame would read a state the completion does not belong to. | **Fixed before landing.** A wait records the index and generation of its task; the generation moves on each time a node is reused, and a completion whose generation does not match is dropped and counted (`nish_async_stat(1)`). A token is checked the same way against the wait slot's own generation, so a spent token answers 0, never another wait's answer. These checks were written with the executor, so there is no before run; pinned by `tests/link/async_late_completion`: "node reused: yes", "resumed the new task: yes, late so far: 1", "resumes: 1, late: 1", "the orphan's token: 0, a spent token: 0". |
| ASYNC-2 | Low | `runtime/runtime-async.c` (`nish_async_done`, `nish_async_wait_free_slot`) | A generation is 32 bits and wraps from `UINT32_MAX` to 1. A wait made by a task whose node is then reused 2^32 - 1 times before the wait completes would match the new task's generation and resume it. | **Open.** It takes four billion spawns of one node while a single stale wait stays pending; a timer is the only wait that outlives its task, and its deadline (at most 24.8 days) is far shorter than that many spawns. A 64-bit generation, which would close it, costs a node header word. |
| ASYNC-3 | Low | `runtime/runtime-async.c` (`nish_async_sleep`, `nish_async_block`) | `sleep(ms)` adds `ms` to the monotonic clock in nanoseconds, and the epoll timeout is an `int` of milliseconds; an unchecked product or a narrowing cast would wrap a long sleep into a short or negative one. | **Fixed before landing.** `ms` is an `i32`, so its nanoseconds (at most 2.15 × 10^15) fit an `i64` beside the clock; a negative `ms` answers `false` at once and never enters the heap; the epoll timeout is rounded up and clamped to `INT32_MAX` milliseconds, and the loop waits again until the first deadline is due. That clamp cannot be reached from Nish source today: an `i32` of milliseconds is at most `INT32_MAX` already; it stays for a caller of the C entry point and for a later wider `sleep`. Pinned by "none false" in `tests/emit-ts/async/sleep` (its native twin is the case test `async_sleep`) and the deadline order of `tests/link/async_timer_order`. |
| ASYNC-4 | Medium | `runtime/runtime-async.c` (`nish_async_wait_fd`, `nish_async_fire`) | A registration keyed on the program's descriptor number would survive the program closing it: once the number is reused (a peer's new connection, a file), the old registration would answer for the new file, and the waiting task would read a socket it never waited on. Two tasks waiting on one number would also overwrite each other's registration. | **Fixed before landing.** A wait duplicates the descriptor (`F_DUPFD_CLOEXEC`) and registers the duplicate one-shot, keyed by the wait's token; the duplicate is removed and closed when the wait fires. Closing the program's descriptor leaves the duplicate open, so the registration still names the original file. A descriptor that cannot be duplicated answers `false`, the same answer as a closed one; that includes a process at its descriptor limit (`EMFILE`), since each pending wait holds one more descriptor than the program opened. A regular file, which never blocks, answers `true`: epoll refuses one (`EPERM`), and on kqueue, which would report a regular file ready only while it is not at end of file, the wait checks `fstat` for `S_ISREG` and answers at once. Pinned by `tests/link/async_fd_reuse`, where a pipe that takes the closed number and is written to does not wake the task ("woken by: the timer", "the wait: -1") and a write to the socket's other end does ("after a write to the pair: 1"), and by `tests/link/async_readable` ("main: readable(-1) false"). |
| ASYNC-5 | Low | the emitted driver (`@nish.async.run`) | The executor is cooperative: a task that loops without an `await` keeps every other task, and `main`, from running, so one peer whose request takes a long computation delays all the others. | **Decided.** It is the language's model (LANGUAGE.md, "Where it is not Node"), as it is JavaScript's: a task yields only at an `await`. The ready queue is FIFO, so a task that does await cannot be passed over by later wakes; the kernel's report is taken in its own order and then the expired timers, earliest first, so neither descriptors nor timers can starve the other kind. |
| ASYNC-6 | Medium | `runtime/runtime-async.c` (`nish_async_next`, `nish_async_block`) | A descriptor that never becomes ready parks its task for ever, and because the loop runs until nothing waits, the program never exits: a peer that connects and sends nothing holds a `readable` wait, and the process, open indefinitely. | **Open.** It needs a deadline on the wait, which is cancellation, a later stage of WP49. Closing the program's descriptor does not end the wait, since the wait holds a duplicate (ASYNC-4); the wait ends when the peer sends or closes its end. A program that must bound it does not `await readable` on a peer it does not trust until cancellation lands. Rated Medium: one idle connection is enough to keep a server from exiting, and nothing in the program can end the wait today. |
| ASYNC-7 | Low | `src/emit-async.ts` (the spawn), `runtime/runtime-async.c` (`nish_async_copy_str`) | A spawned task outlives its spawner, so an argument that pointed into the spawner's arena would be read after that arena was released. | **Decided.** A `string` argument is copied into the task's own region before the task first runs; a number or `boolean` is copied by value; any other type is refused at compile time (NL2673, LANGUAGE.md). Pinned by `tests/link/async_spawn_args`, whose spawner builds 2890 characters of noise in the memory its arguments came from before the tasks read them. |
| ASYNC-8 | Low | `runtime/runtime-async.c` (`nish_async_spawn`, `nish_async_enter`, `nish_async_leave`, `nish_async_done`) | A task's allocations land in whatever arena is current when it runs; with one arena for all tasks, a task that finished would leave its memory to be freed only when `main` returns, and a long-running server would grow by every request it ever served. | **Decided.** Each spawned task owns a region, entered around every resume and freed when the task finishes, and a node's region is made fresh for each task it holds. Pinned by `tests/link/async_region_per_task` and the slab's reuse by `tests/link/async_slab_flat` ("after a thousand rounds: 12 nodes, peak 10 live, 0 live now"). |
| ASYNC-9 | Low | `runtime/runtime-async.c` (`nish_async_wait_fd`, `nish_async_fire`) | Readiness is a report, not a reservation. Two tasks waiting on one descriptor are both woken by one byte; the first to read takes it, and the second's read, on a blocking descriptor, blocks the thread and with it every task. | **Open.** One reader per descriptor is the program's to keep; a server gives each connection to one task. A non-blocking descriptor, which `nish:net` does not yet offer, would turn the loser's read into a short one. |

## Failures that stop the program

The executor ends the process with a message on stderr, and status 1, rather
than run on in a state it cannot keep (`nish_async_die`):

- `nish: out of memory`: the task slab, the wait table
  or the timer heap could not grow;
- `nish: the async event loop could not be made`: the poller (`epoll_create1`
  or `kqueue`) could not be made, on the first wait;
- `nish: more than 4294967294 async tasks or waits`: too many to index;
- `nish: the async event loop could not wait`: `epoll_wait` or `kevent` failed
  with anything but `EINTR`. Before this, such a failure looked like an empty
  report, and the loop spun on it.

## Properties verified

- **The executor is not linked into a program without `async`.**
  `scripts/build.sh` links `runtime-async.c` only when the IR declares a
  `@nish_async_` function; a non-async program's IR is byte-identical to its
  IR before the executor landed, and `llvm-nm` finds no `nish_async` symbol in
  its binary.
- **Nothing in the executor calls into the program.** The driver resumes a
  node through a `switch` over the task kinds the compiler knows; a node holds
  no function pointer, so a corrupt node header can reach only the switch's
  trap.
- **Its size is budgeted.** `tests/runtime-budgets.js` holds its `-Oz`
  `.text` to `RUNTIME_ASYNC_TEXT_BUDGET`.

## Tests

- `tests/link/async_late_completion` (ASYNC-1, ASYNC-2's check)
- `tests/emit-ts/async/sleep`, `tests/cases/async_sleep` (ASYNC-3)
- `tests/link/async_timer_order` (ASYNC-3, ASYNC-5's timer order)
- `tests/link/async_fd_reuse`, `tests/link/async_readable` (ASYNC-4)
- `tests/link/async_spawn_args`, `tests/cases/async_sleep_spawn_string`,
  `tests/cases/reject_async_spawn_*` (ASYNC-7)
- `tests/link/async_region_per_task`, `tests/link/async_slab_flat` (ASYNC-8)
- `tests/link/async_sync_main_loop` (the loop a synchronous `main` runs)
- `tests/runtime-budgets.js` (`RUNTIME_ASYNC_TEXT_BUDGET`)
