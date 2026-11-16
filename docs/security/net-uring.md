# Security record: the io_uring ring layer

The record of `runtime/runtime-uring.c`, the io_uring rings that WP63 puts
under `nish:net`: one accepting job spread over a set of rings, each ring
holding up to `slots` connections as direct descriptors, a provided-buffer
ring for receives, and queued sends. Every byte a connection carries comes
from a remote peer, and every completion the layer reads comes from the
kernel's shared rings, so both are attacker-facing.

It says what is checked, what each failure answers, and the test that pins
each answer. The design is
[`wp63-iouring-net.md`](https://github.com/amritk/nish/blob/main/docs/wp63-iouring-net.md).
It was written on top of `main` at `307dcca`, in the change that adds the
layer (WP63 S1), and names functions rather than lines, so it has no
`file:line` anchors to move. In this stage nothing in `nish:net` calls the
layer: it is linked into every Linux runtime and reached only by its C test.

**Result.** No completion the kernel writes and no byte or reset a peer
sends can make the layer index outside its tables: an accepted slot, a
buffer id and a receive's slot are each checked against the size the set was
made with, and a completion for a slot closed since is recognised by its
generation and only gives back its buffer. A slot handle a caller passes is
checked before use and answers `-EBADF`. A double free a peer could cause by
resetting a connection during a send (NURING-1) was found in review and
fixed before landing, and so was a wait that could return with a ring's new
accepts still queued in user space, so a caller sleeping on the set's
descriptor left new peers in the backlog (NURING-7), and a sleep on that
descriptor while the kernel held a ring's accept as task work it never
signalled (NURING-8, on CI's 7.0 kernel). Two findings are open, both for
S2's surface: queued sends to a peer that never reads are not bounded
(NURING-2), and a set that cannot grow stops accepting without telling its
caller (NURING-6). Eight findings (NURING-1 to NURING-8): three fixed, two
open, three decided. The
kernel's own io_uring flaws that S1's operations reach, and the kernels that
fix them, are under "The kernel's record" below.

## Scope

| File | What |
| --- | --- |
| `runtime/runtime-uring.c` | the probe (`nish_uring_probe`, `ur_probe_once`, `ur_setup_flags`); the set and its rings (`nish_uring_open` and its option checks, `ur_add_ring`, `ur_free_ring`, `nish_uring_destroy`); the accepting job (`ur_top_up`); completions (`ur_complete`, `ur_reap`, `ur_service`, `ur_catch_up`, `nish_uring_wait`); receives and buffers (`ur_arm`, `ur_recycle`); sends (`nish_uring_send`, `ur_send_head`, `ur_drop_sends`, `ur_unlink_all`); slots (`ur_open_slot`, `nish_uring_close`); and the stubs a native build off Linux links (a wasm build compiles none of the file) |
| `tests/runtime/uring-test.c` | the test: an echo server on the layer in a forked child, driven by plain-socket clients, one mode a check; and the `UR_SYS_SETUP` and `UR_SYS_REGISTER` hooks it compiles the layer with, which stand in for the two syscalls to force the answers a seccomp filter cannot |

Out of scope: `runtime/runtime-net.c`, whose epoll path does not call the
layer, and `bench/fd-limit/`, the prototype the design measured. The rule for
rings under `--sandbox` is S3's and lands with `sandbox.md`.

## Threat model

**Who is trusted.** The program's own code, the person who runs it, and the
kernel. The layer reads the kernel's completion queue as input and checks the
indices in it, but a kernel that lies about which buffer it filled is not an
adversary this record defends against.

**Who is the adversary.** A remote peer, or many of them. A peer can open
connections at any rate, up to and past the process's descriptor limit; send
any bytes in any split; stop reading; and close or reset at any moment,
including while a receive or a send for its connection is in the kernel. Its
aim is to make the layer read or write outside its tables or buffers, free a
record twice, hand one connection's bytes to another, or stop it accepting.

**What is not claimed.** How many connections a peer may hold, and for how
long, is the server's policy, not the layer's: the layer holds what fits in
its slots and stops accepting while they are full. The bytes are not
authenticated or encrypted; that is TLS's job, above this.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| NURING-1 | High | `runtime/runtime-uring.c` (`ur_complete`) | A send that failed for good (a peer's reset answers `-ECONNRESET` or `-EPIPE`) cleared the record's in-flight mark and then called `ur_drop_sends`, which frees every queued record that is not in flight, the failed one included, and then freed the record a second time with `ur_unlink_all`. A peer could cause it by resetting while a large send was in the kernel: heap corruption from the network. | **Fixed before landing**: the second free is gone, and `ur_drop_sends` frees the record with the rest of the slot's queue. Before: the "reset" mode's server died of a signal (glibc's double-free abort) on every run. After: "uring: runtime-uring.c reset: a send the peer resets fails once as SEND_FAILED, and its record is freed once". |
| NURING-2 | Low | `runtime/runtime-uring.c` (`nish_uring_send`) | Each send copies its bytes into a record that is queued until the kernel takes them. A peer that never reads leaves every later send for its slot queued, so a server that keeps answering it grows without bound. | **Open**, for S2: the layer reports nothing a caller could use as backpressure, and `nish:net`'s surface must bound the bytes queued per connection, or expose them, before a program can reach the layer. Tracked in #1648. |
| NURING-3 | Low | `runtime/runtime-uring.c` (`ur_complete`, `nish_uring_wait`) | A DATA event's bytes are the provided buffer the kernel filled, lent, not copied: they are given back to the kernel at the start of the next `nish_uring_wait`, and a caller that keeps the pointer past it reads bytes another connection's receive may have written. | **Decided.** The copy would cost every receive; the contract is in the header comment ("valid until the next wait"), and S2's surface copies the bytes into the program's array before the next wait. |
| NURING-4 | Low | `runtime/runtime-uring.c` (`ur_tag`, `nish_uring_close`) | A slot's generation is 24 bits, so a recv's completion that arrives after 2^24 closes of the same slot would match a newer connection's generation. | **Decided.** `nish_uring_close` cancels the slot's recv before it closes it, in the same submission, so no recv of the slot outlives the close by more than one completion; 2^24 closes and re-accepts of one slot in that window cannot happen. |
| NURING-5 | Low | `runtime/runtime-uring.c` (`ur_complete`) | A send the kernel answers with 0 bytes, for a record with bytes left, is taken as complete, and the bytes left are not sent. | **Decided.** A stream socket's send does not answer 0 for a non-empty buffer; re-arming on 0 would spin on a kernel that did. The connection's next send or recv reports any real failure. |
| NURING-6 | Low | `runtime/runtime-uring.c` (`ur_top_up`) | A set whose every ring is full and that cannot open another (`ur_add_ring` answers `-ENOSPC` at `rings_max`, or its setup fails for want of memory or descriptors) stops queuing accepts and says nothing: no event tells the caller, so new peers wait in the listener's backlog until the kernel drops them there. No connection already accepted is lost. | **Open**, for S2: the surface must report a full set to the program as `-ENFILE` (-23), the answer a full table gives, without dropping or closing any accepted connection, and take accepting up again when a slot closes. Tracked in #1648. |
| NURING-7 | Medium | `runtime/runtime-uring.c` (`nish_uring_wait`, `ur_top_up`) | A wait serviced each ring and submitted that ring's own queue, but an accept or a close on one ring can move the accepting job to a ring the wait already passed (or will not reach: `cap` full, or not ready). That ring's new accepts sat in user space while the caller slept on `nish_uring_fd`, which nothing would signal: new peers waited in the backlog until some other event woke the caller. A peer cannot cause it alone, but any server whose set grows past one ring could stop accepting. | **Fixed before landing**: `nish_uring_wait` hands every ring's queued submissions to the kernel before it returns or sleeps (`ur_submit_queued`), so a wait returns with nothing queued unless the kernel refuses the submission (-EBUSY while completions overflow, which leaves completions for the eventfd to signal, or a transient -EAGAIN or -ENOMEM); the next wait submits it again. Before: "uring: runtime-uring.c move" failed on every run (5 of 5 on 6.18.44) with "a wait returned 1 events with 1 submissions still queued on ring 0". After: "uring: runtime-uring.c move: an accept or a close that moves the accepting job to a ring the wait passed leaves nothing queued in user space when the wait returns". |
| NURING-8 | Medium | `runtime/runtime-uring.c` (`nish_uring_wait`, `nish_uring_fd`, `nish_uring_sleep_ms`) | The layer and its callers slept on the set's epoll descriptor and trusted each ring's eventfd to say the kernel had queued work. On CI's kernel (7.0.0-1019-azure) a client's accept completed in the kernel and waited as deferred task work, with IORING_SQ_TASKRUN up, while the eventfd was never signalled: the caller slept with a peer accepted but not reaped. The mechanism, at v7.0: `io_req_local_work_add` signals the eventfd only when the task-work list was empty (`io_uring/tw.c:223-236`), and a signal raised in a nested context is deferred by `__io_eventfd_signal`, which first sets `IO_EVENTFD_OP_SIGNAL_BIT` with `atomic_fetch_or` (`io_uring/eventfd.c:53-64`, line 59) and skips the signal if the bit was already set; `io_eventfd_do_signal` (`eventfd.c:42`) signals and never clears it, and only registering the eventfd again resets `ops` (`eventfd.c:153`). After the first deferred signal every later one is lost, for the life of the registration. 6.1 clears the bit (`atomic_xchg(&ev_fd->ops, 0)` in `io_eventfd_ops`, `io_uring/io_uring.c:495`) and signals and wakes on every first add (`io_uring.c:1108-1128`). No other kernel wake is sure: the submitter is woken only when `nr_tw >= cq_wait_nr`, and outside `io_uring_enter` that is `IO_CQ_WAKE_INIT` (`io_uring.c:250`); polling the ring's own descriptor sleeps on `poll_wq` (`io_uring_poll`, `io_uring.c:2240-2276`), which only `__io_commit_cqring_flush` wakes when completions post (`io_uring.c:478-485`), and under DEFER_TASKRUN they post only when the submitter runs the task work; re-registering the eventfd each wait would cost two syscalls a wait and still leaves no way to see the bit. A peer cannot cause it alone, but any server could stop accepting until another event woke it. | **Fixed before landing**: no sleep on a ring set is longer than `UR_SLEEP_MAX_MS` (10 ms), so the hrtimer is the wake the kernel guarantees, on every version. `nish_uring_wait` sleeps for `nish_uring_sleep_ms`, which answers 0 while a ring is flagged IORING_SQ_TASKRUN or IORING_SQ_CQ_OVERFLOW, has completions not reaped, or has parked recvs, stalled sends or lent buffers that a free submission queue could take, and otherwise the caller's timeout capped at 10 ms; a wait of -1 that wakes with nothing goes round again, and every wake services every flagged ring, ready or not. `nish_uring_fd`'s contract says a caller that sleeps on the descriptor, alone or beside other sources, sleeps no longer than `nish_uring_sleep_ms` answers and then waits with 0. S2's `pollWait` over rings must keep the rule. Cost, measured on 6.18.44 (one-ring set, idle, 3 runs of 5 s, 4-core container): 98.6 to 98.8 wakes a second, 0.348% to 0.365% of one core, 35 to 37 µs a wake; a busy set never reaches the bound. Before, on 7.0.0-1019-azure (CI shard 5, job 133074815366): "uring-test: ring 0: live 1 accepting 1 to_submit 0 sq_flags 0x4 sq head 3 tail 3 cq head 1 tail 1 efd readable 0", fdinfo showing the accept (op 13) in the poll list and no overflow. After: "uring: runtime-uring.c nowake: a client that connects while a wait of -1 sleeps on a ring whose eventfd is gone is accepted by the sleep's bound (NURING-8)", which unregisters the eventfd to stand for the lost signal; a mutant whose `nish_uring_sleep_ms` answers the caller's timeout hangs it to its 10 s alarm on 6.18.44. The "move" check sleeps on `nish_uring_fd` for as long as `nish_uring_sleep_ms` answers. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding. The
tests are the modes of `tests/runtime/uring-test.c`, run by `tests/run.js`'s
`uring` section, each as one check: "uring: tests/runtime/uring-test.c
compiles with runtime-uring.c under -Werror", then "uring: runtime-uring.c
${mode}: ${what}". Each mode's server also requires that its set ends with no
live connection, no bound violation and no accept error, and that `destroy`
closes every descriptor the set opened. A mode that needs io_uring skips
where the probe says it is refused.

- **Past the descriptor limit.** "uring: runtime-uring.c beyond: 3,000
  connections held at once under RLIMIT_NOFILE 1,024, in three rings, fewer
  than 64 descriptors": the direct descriptors are not in the process's
  table, and a full ring opens the next one.
- **The accept bound.** "uring: runtime-uring.c bound: a full one-ring set
  of 8 slots serves 50 clients and drops none (the accept bound)": the layer
  never has more accepts in the kernel than free slots, so an accept never
  lands past the table, and a closed slot goes back to the accepting job.
  An accepted slot at or past `slots` is counted as a bound violation, never
  used.
- **The kernel's re-entry flags.** "uring: runtime-uring.c taskrun: a burst
  of 100 queued on one ring is taken by one wait, entering again while
  IORING_SQ_TASKRUN is up" and "uring: runtime-uring.c overflow: a CQ of 8
  under 256 clients overflows and is drained": completions the kernel held
  back are taken, not lost. The taskrun server holds 100 clients until all
  are accepted, so their sends are queued as task work together, then asks
  one `nish_uring_wait` with no timeout for every event: a DEFER_TASKRUN ring
  runs at most 20 queued completions per enter on 6.13 and later, so a layer
  that does not enter again takes 20 of the 100 (a mutant without the
  re-entry answered "one wait took 1280 of the burst's 6400 bytes" on
  6.18.44, on every run). On 6.18 and later the re-entry counter must also
  move. A kernel without the cap has nothing to re-enter for and passes
  either way.
- **Nothing is left queued.** "uring: runtime-uring.c move: an accept or a
  close that moves the accepting job to a ring the wait passed leaves nothing
  queued in user space when the wait returns" (NURING-7): a two-ring set of
  two slots each takes five clients one at a time, so accepts move the job
  from ring 0 to ring 1 and a close moves it back; after every wait no ring
  has a submission queued, and each client is accepted while the server
  sleeps on `nish_uring_fd` alone. The sleep alone would not catch the bug:
  the ring's eventfd is level-triggered and still readable after the wait
  that left the accept queued, so the next wait submits it (a mutant without
  the queued check passed 3 of 3). The invariant after every wait is the
  check. Each sleep lasts as long as `nish_uring_sleep_ms` answers, as
  the descriptor's contract says (NURING-8), and a client not accepted
  within 5 seconds, or a set that never goes idle in 100 waits, prints the
  kernel, each ring's flags, heads and fdinfo, and fails.
- **A lost eventfd signal.** "uring: runtime-uring.c nowake" (NURING-8):
  with ring 0's eventfd unregistered, a client that connects 200 ms into a
  wait of -1 is accepted within 1,200 ms, by the sleep's bound alone.
- **Buffers run out.** "uring: runtime-uring.c nobufs: a recv that runs out
  of provided buffers is re-armed, not closed": a peer that fills every
  buffer delays the others' receives and closes nothing.
- **Sends.** "uring: runtime-uring.c short: an 8 MiB send the kernel takes
  short arrives whole and in order", and NURING-1's "reset" check.
- **Stale handles.** Every mode that closes a slot checks, once, that a send
  and a second close on the closed slot answer `-EBADF`.
- **Refused io_uring.** "uring: runtime-uring.c fallback: a refused setup
  or register (EPERM, ENOSYS, EINVAL on both tries) or a missing feature or
  opcode answers what sends a caller to epoll, with no descriptor left": the
  probe and `nish_uring_open` answer the refusal with no set, and the caller
  keeps the epoll path. A seccomp filter (native arch only) answers
  io_uring_setup with EPERM, ENOSYS or EINVAL and io_uring_register with
  EPERM or EINVAL; through the hooks, setup answers -EINVAL to both of
  `ur_setup_flags`'s attempts (the second must add COOP_TASKRUN, and the
  probe answers -EINVAL), FEAT_NODROP is hidden, or the SEND opcode is
  hidden (each -EOPNOTSUPP). A kernel that wants COOP_TASKRUN takes the
  second attempt, and the set opens on it. The refused-setup cases run on any
  Linux; the rest skip where the kernel has no io_uring. Each of five mutants
  of the probe (no COOP retry, no NODROP check, no EINVAL-to-EOPNOTSUPP
  mapping, no opcode check, an open that does not pass the probe's answer
  on) fails the mode.
- **The unit builds into every runtime.** "runtime.c, runtime-os.c,
  runtime-text.c, runtime-parallel.c, runtime-cross.c, runtime-host.c,
  runtime-net.c, runtime-uring.c, runtime-simd.c, runtime-aes.c,
  runtime-sha256.c, runtime-chacha20.c, runtime-checksum.c, runtime-term.c,
  runtime-bytes.c, runtime-sandbox.c, runtime-shm.c and runtime-region.c
  compile warning-free together and pass the runtime unit test", and its
  `.text` budget, "runtime-uring.c: .text* at -Oz fits the 6144 byte
  budget".

## The kernel's record

The layer's safety rests on the kernel's io_uring as much as on its own
checks, and io_uring has the longest CVE record of any kernel subsystem since
5.10. What follows is the part of that record S1's configuration can reach:
the setup flags `SINGLE_ISSUER`, `DEFER_TASKRUN`, `TASKRUN_FLAG`,
`SUBMIT_ALL`, `CQSIZE` (and `COOP_TASKRUN` on the retry); the operations
`ACCEPT` with `IORING_FILE_INDEX_ALLOC`, multishot `RECV` from a provided
buffer ring, `SEND`, `CLOSE` on a fixed file and `ASYNC_CANCEL`; and the
registrations `PROBE`, sparse `FILES2`, `PBUF_RING` (with memory the layer
maps itself) and `EVENTFD`.

**How this list was made.** Each row was checked on 2026-11-16 against its
CVE record in `cvelistV5` (`github.com/CVEProject/cvelistV5`, `cves/`), the
CNA's `affected` versions and the fix commit it cites. "Fixed in" is the
first mainline release outside the affected range; stable backports reach
older series. Two records give no clean range: CVE-2024-0582's CNA (Red Hat)
marks only kernels before 6.4 unaffected, and its fix (`c392cbecd8ec`)
landed in 6.7; CVE-2023-46862's (MITRE) says "through 6.5.9", and its fix
(`7644b1a1c9a7`) landed in 6.6. Before S2 makes the layer reachable from a
program, look again for newer ones in the kernel CNA's record
(`git.kernel.org/pub/scm/linux/security/vulns.git`, `cve/published/`,
searched for `io_uring/`) and NVD. Since 2024 the CNA assigns a CVE to most
io_uring fixes, so the full record is far longer than this; these are the
memory-safety flaws in code S1 drives.

**The floor the probe sets.** `ur_probe_once` accepts a kernel only if setup
takes `SINGLE_ISSUER` and `DEFER_TASKRUN` (6.0 and 6.1), sparse file
registration and `PBUF_RING` register (5.19), and the probe lists the five
operations. In practice that is 6.1 or later, or a vendor kernel that
backported these, so a flaw fixed in mainline before 6.1 is reachable only
on a vendor kernel that took the feature without the fix.

| CVE | What, in code S1 reaches | Fixed in | S1 |
| --- | --- | --- | --- |
| CVE-2023-0469 | use after free installing a fixed file (`io_install_fixed_file`): `ACCEPT` and `CLOSE` on direct descriptors | 6.1 | reached by S1's operations; fixed before 6.1 was released, so below the floor |
| CVE-2023-1872 | `io_file_get_fixed` without the ring lock in io-wq: a use after free on fixed files | 5.18 | below the floor |
| CVE-2023-3389 | cancelling a poll request that has a linked timeout races the timeout: a use after free in an hrtimer | 6.4 (5.13 to 6.3 affected; 5.10.162 to 5.10.184 too) | not reached: above the floor, but it needs a linked timeout (`IOSQE_IO_LINK` with `LINK_TIMEOUT`), and the layer links no requests and submits no timeout |
| CVE-2022-2602 | registered files and the unix socket garbage collector: a use after free | 6.1 | not reached: it needs an io_uring descriptor passed over a unix socket, and a TCP peer cannot pass one |
| CVE-2024-0582 | `PBUF_RING` with kernel-allocated memory (`IOU_PBUF_RING_MMAP`), unregistered while mapped: a use after free | 6.7 (6.4 to 6.6 affected) | not reached: the layer maps the buffer ring's memory itself and never passes the flag |
| CVE-2023-6560 | `IORING_SETUP_NO_MMAP`'s ring mapping: out of bounds | 6.7 | not reached: the layer maps its rings |
| CVE-2023-2598 | registered fixed buffers (`REGISTER_BUFFERS`): out of bounds | 6.4 | not reached: no fixed buffers |
| CVE-2023-46862 | `SQPOLL` and the fdinfo reader: a null dereference | 6.6 | not reached: no `SQPOLL` |
| CVE-2021-41073 | classic provided buffers (`IOSQE_BUFFER_SELECT`) on a read: type confusion | 5.15 | not reached: receives only, from a buffer ring |

The rows marked "below the floor" are reachable only on a kernel older than
the probe accepts, or a vendor kernel that backported features without
fixes. Nothing here is a flaw in the layer; the decision it informs is which
kernels may run it, and the probe's feature floor is that decision for now.
A deployment that must pin a kernel should take a 6.1-or-later stable
release with the current stable fixes, since the CNA's record keeps adding
fixes to the multishot receive, provided-buffer and fixed-file code.

**What S3 adds.** The framing of this record around a restricted ring is
S3's, with `sandbox.md` (the design's §6.2): under `--sandbox` each ring is
created with `IORING_SETUP_R_DISABLED` and given
`IORING_REGISTER_RESTRICTIONS` (the five operations above and `NOP`; no
registration after enabling), and the filter then kills `io_uring_setup` and
`io_uring_register`. S1 makes no restricted ring, so this section lists what
S1's own rings reach; S3 extends it with the restriction check's own record
and with which rows a restricted ring of those six opcodes still reaches.

## Notes

**The checks on the kernel's indices.** A receive's buffer id is checked
against `buf_count` before its buffer is touched, and a completion whose slot
is past `slots`, not open, or of an older generation only gives its buffer
back. These are cheap and keep a kernel bug from becoming a write outside
the buffer ring; they are not a defence against a hostile kernel.

**`destroy` with sends in flight.** `nish_uring_destroy` closes the rings
first, which cancels every request the kernel held, and then frees every
send record, in flight or not, and unmaps the buffers. Nothing can copy from
a freed record or into an unmapped buffer meanwhile: the rings are made with
`IORING_SETUP_DEFER_TASKRUN`, so a send or receive waiting on its socket is
retried only as task work on the thread that owns the ring, which is the one
running `destroy`. This rests on one assumption about the kernel: that
closing a ring cancels the task work still queued on it rather than running
it, from a fallback worker, after `close` returns. The code cannot show that
window closed on every kernel the probe accepts; S2, which makes `destroy`
reachable from a program, revisits it.

**Options.** `nish_uring_open` refuses a `buf_count` that is not a power of
two or is past 32,768, a `buf_size` past 1 MiB, a `rings_max` past 4,096
and `slots` past 2^20, with `-EINVAL`, before it maps anything.
