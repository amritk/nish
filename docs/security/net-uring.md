# Security record: the io_uring ring layer

The record of `runtime/runtime-uring.c`, the io_uring rings that WP63 puts
under `nish:net`, and of the slot layer in `runtime/runtime-net.c` that gives
them to a program: one accepting job spread over a set of rings, each ring
holding up to `slots` connections as direct descriptors, a provided-buffer
ring for receives, and queued sends. Every byte a connection carries comes
from a remote peer, and every completion the layer reads comes from the
kernel's shared rings, so both are attacker-facing.

It says what is checked, what each failure answers, and the test that pins
each answer. The design is
[`wp63-iouring-net.md`](https://github.com/amritk/nish/blob/main/docs/wp63-iouring-net.md).
It was written on top of `main` at `307dcca`, in the change that adds the
layer (WP63 S1), and extended in WP63 S2, which makes the layer reachable from
a program: a listener made with `tcpListenFlags(..., NET_LISTEN_RING)` accepts
into ring slots, and `tcpAccept`, `netRead`, `netWrite`, `netClose`,
`pollAdd`, `pollModify` and `pollWait` take the slot handles it answers. It
names functions rather than lines, so it has no `file:line` anchors to move.

**Result.** No completion the kernel writes and no byte or reset a peer
sends can make the layer index outside its tables: an accepted slot, a
buffer id and a receive's slot are each checked against the size the set was
made with, and a completion for a slot closed since is recognised by its
generation and only gives back its buffer. A slot handle a caller passes is
checked before use and answers `-EBADF` until its slot has been reused as
many times as the generation field can count, never fewer than 64; past that
it aliases the newer connection (NURING-29). A double free a peer could cause by
resetting a connection during a send (NURING-1) was found in review and
fixed before landing, and so was a wait that could return with a ring's new
accepts still queued in user space, so a caller sleeping on the set's
descriptor left new peers in the backlog (NURING-7), and a sleep on that
descriptor while the kernel held a ring's accept as task work it never
signalled (NURING-8, on CI's 7.0 kernel). S2 closes the two findings S1 left
for it: a slot's queued sends are bounded at 256 KiB, past which `netWrite`
answers -11 (NURING-2), and a full set answers -23 from `tcpAccept` (NURING-6).
S2's review found that the multishot receive went on taking a peer's bytes
into the slot's queue while the program read none of them, so a peer could
grow the queue without bound (NURING-9); the slot's receive is now held at
256 KiB and the peer stalls in the kernel's buffers. The same review found a
close after the peer's FIN that dropped the slot's queued sends (NURING-10)
and a closed loop whose slots stayed registered to it (NURING-11), both fixed
before landing, and left two bounds open: a lingering close has no deadline
(NURING-12), and accepting at once takes peers out of the listener's backlog
(NURING-13). A second round found that a wait whose batch the ready slots
filled never asked the epoll set, so a descriptor beside them, `signalFd()`
among them, was never reported (NURING-18), fixed before landing. A fourth round found that
a later ring listener whose set's open failed answered the failure instead of
falling back (NURING-22) and that a slot its peer reset still took writes
(NURING-23), both fixed before landing. A fifth round found that a ring
listener whose set's open failed after a probe that passed still kept rings
as decided (NURING-26) and that a slot a reset had hung up was armed again
once a hold let it go (NURING-27), both fixed before landing. A sixth round
found that a transient accept error such as `-ENOMEM` stopped a ring listener
for good (NURING-28), fixed before landing: memory pressure now pauses
accepting with a back-off, and recorded that a stale handle aliases once its
slot's generation wraps (NURING-29, decided). S3 makes the layer
reachable under `--sandbox`: with `net` granted and `process.spawn` withheld,
the rings a ring listener takes are made before the seccomp filter loads,
restricted to six operations and three submission flags, and the filter
then kills `io_uring_setup` and `io_uring_register` and lets
`io_uring_enter` take only those rings' descriptor numbers (`sandbox.md`
holds that rule). Its review found that a restricted ring, which drops
`SINGLE_ISSUER` and `DEFER_TASKRUN`, took a kernel below the probe's floor
(NURING-33), and that the filter let `io_uring_enter` take any descriptor,
so a ring made outside the sandbox and inherited across `exec` ran every
operation (NURING-35), both fixed before landing; fixed after landing that
the filter matched numbers, not files, so a foreign ring could be put at a
premade ring's number (NURING-36); and decided the spent pool's
counter guard, which no test reaches (NURING-34), the pool's latch on a
transient failure (NURING-37) and three costs of making the rings at start
(NURING-30 to NURING-32). Fixed after landing that an idle slot kept its
receive queue (NURING-38). WP63's ring gaps give `netShutdown` a slot path:
the restriction takes `SHUTDOWN` as a seventh operation, and a close waits
for a shutdown in flight, which the kernel resolves late (NURING-39,
decided). The send pool (issue #2247) defers a slot's SEND to the ring's
next submit and appends later writes to the unsubmitted record, from a
per-ring pool of 16 KiB buffers: a close that dropped the deferred head was
fixed before landing (NURING-40), the pool keeps at most 32 free buffers a
ring (NURING-41, decided), a buffer the kernel holds is reused only after its
completion (NURING-42, decided), and writes between repeated shutdowns each
held a buffer until a shutdown of a side already queued queued nothing
(NURING-43, fixed before landing); what bounds the rest of a slot's memory
is read from the code only (NURING-44, open, untested). The direct ring wait
lets a loop of ring slots sleep in `io_uring_enter` rather than
`epoll_wait` for `pollWait` and for `pollWaitBatch`'s first wait (the
batch's second wait sleeps in `poll(2)` slices), watching `signalFd()` by a `POLL_ADD` in its ring, which a restricted ring is refused (NURING-45,
decided), and a batch's second wait reads no epoll set, so an ordinary
descriptor can wait up to the program's `maxWaitMs` (NURING-46, decided).
Fixed before landing: a batch on a loop no ring source had joined waited out
its `maxWaitMs` (NURING-47), and a socket that took a closed `signalFd()`'s
number was taken for the ring's watch and never reported (NURING-48), after
`netClose` and again after `fileClose`, which the first fix missed
(NURING-49), and a signal whose poll an earlier pump had reaped waited out
one whole enter (NURING-50).
A write past its slot's last pool buffer took one exact allocation of its
whole length, and a shutdown a `calloc` of its own, so steady large responses
allocated a record each; both now take pool buffers, chained behind the
slot's last (NURING-51, fixed).
Fifty-one findings (NURING-1 to NURING-51): twenty-seven fixed, three open
(NURING-12, NURING-13, NURING-44), twenty-one decided. The
kernel's own io_uring flaws that S1's operations reach, and the kernels that
fix them, are under "The kernel's record" below.

## Scope

| File | What |
| --- | --- |
| `runtime/runtime-uring.c` | the probe (`nish_uring_probe`, `ur_probe_once`, `ur_setup_flags`); the set and its rings (`nish_uring_open` and its option checks, `ur_add_ring`, `ur_free_ring`, `nish_uring_destroy`); the accepting job (`ur_top_up`); completions (`ur_complete`, `ur_reap`, `ur_service`, `ur_catch_up`, `nish_uring_wait`); receives and buffers (`ur_arm`, `ur_recycle`); sends (`nish_uring_send`, `ur_send_head`, `ur_drop_sends`, `ur_unlink_all`; the pool's additions are the row below); slots (`ur_open_slot`, `nish_uring_close`); and the stubs a native build off Linux links (a wasm build compiles none of the file) |
| `runtime/runtime-uring.c`, for the send pool | the deferred submit (`ur_mark`, `ur_send_marked`, called at the start of `ur_service` and in `ur_submit_queued`), the append to a slot's last record and the pool buffers chained behind it (`nish_uring_send`), the pool (`ur_record`, `ur_release`, and `ur_free_ring` freeing what a ring caches), `nish_uring_close`'s submit of an unsubmitted head, and the counters `nish_uring_stats` reports (`sends`, `pool_new`, `pool_held`, `pool_cached`); `nish_net_write2`'s two `nr_send` calls now leave as one SEND through the append, with no change to `runtime-net.c` |
| `runtime/runtime-uring.c`, for S2 | what S2 adds for the slot layer: the bytes a slot has queued (`nish_uring_queued`), whether the set can take no more (`nish_uring_full`), and holding a slot's receive (`nish_uring_hold`, with `ur_complete`'s and `ur_catch_up`'s handling of a held slot) |
| `runtime/runtime-net.c` | the slot layer: the handle encoding and its checks (`nr_encode`, `nr_decode`, `nr_listener`, `nr_vent_for` and the routing in each `nish_net_*` entry), a ring listener's set (`nr_open`, `nr_close_listener`), accepting (`nr_accept`), the events a wait takes in (`nr_pump`, `nr_pump_all`, `nr_dispatch`), a slot's receive and send queues (`nr_read`, `nr_send`), its close and its lingering sends (`nr_close`, `nr_finish`), readiness in a poll loop (`nr_ctl`, `nr_collect`, `nr_poll_wait` and the readiness list, `nr_append`, `nr_unlist`, `nr_touch`, `nr_unregister`, `nr_bits`), and `nish_net_ring_state` |
| `runtime/runtime-uring.c`, for S3 | the rings made before the filter: `nish_uring_premake` and the pool it fills, a restricted ring's setup in `ur_make_ring` (`ur_ops_ok`, then `ur_restrict`, then enabling it last), `ur_add_ring` taking a premade ring, the pool's answers to the probe (`nish_uring_probe`) and to a set's open (`nish_uring_pooled`, and `nish_uring_open`'s defaults), and `nish_uring_test_submit`, the test-only hook compiled only with `-DNISH_URING_TEST_HOOKS`, which `scripts/build.sh` never passes |
| `runtime/runtime-uring.c`, for the direct wait | `nish_uring_wait_direct` (its refusals, the `POLL_ADD` it arms on a watched descriptor, the `IORING_ENTER_EXT_ARG` timeout and the minimum it waits for), `nish_uring_poll_events`, and `ur_complete`'s handling of `UR_POLL` |
| `runtime/runtime-net.c`, for the direct wait | `nr_direct` (which loops may sleep on their ring) and the descriptor notes it reads (`nr_fd_note`, `nr_fd_forget`, `nr_fds` and its `NR_FDS` overflow), `nr_poll_wait`'s direct path, the ring sets it collects (`nr_collect_from`, `nr_epoch` against each set's `seen`), `nish_net_close`'s call of `nish_signal_fd_closing`, and `pollWaitBatch`: `nish_poll_wait_batch`, which bounds a batch by `ready`'s room, and its second wait, `nr_batch` |
| `runtime/runtime-host.c` and `runtime/runtime-os.c`, for the direct wait | `nish_signal_fd_made`, which names the descriptor a ring may watch and names none once it is closed, `nish_signal_fd_closing`, which records that close, and `nish_file_close`'s call of it |
| `runtime/runtime-net.c`, for S3 | `nish_net_ring_premake`, which `nish_sandbox` calls with the soft descriptor limit as each ring's slots (`nr_slots`), and `nr_open`'s use of the pool: the pool's slots, and a failure that latches for good |
| `tests/link/net_ring_*` | the S2 tests: Nish programs on ring listeners, each judged by its own exit status, and `client.mjs`, the node client that drives them from outside their descriptor limit |
| `tests/runtime/uring-test.c` | the test: an echo server on the layer in a forked child, driven by plain-socket clients, one mode a check; and the `UR_SYS_SETUP` and `UR_SYS_REGISTER` hooks it compiles the layer with, which stand in for the two syscalls to force the answers a seccomp filter cannot |

Out of scope: `runtime/runtime-net.c`'s descriptor and epoll paths, which a
slot handle never reaches (`runtime.md` holds them), and `bench/fd-limit/`, the
prototype the design measured. Whether `--sandbox` makes rings at all, how
many, and the filter's rows for the three io_uring calls are `sandbox.md`'s;
this record holds the rings themselves.

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
| NURING-2 | Low | `runtime/runtime-uring.c` (`nish_uring_send`), `runtime/runtime-net.c` (`nr_send`) | Each send copies its bytes into a record that is queued until the kernel takes them (since the send pool, appended to the slot's unsubmitted last record where it has room, and counted into the slot's queued bytes either way). A peer that never reads leaves every later send for its slot queued, so a server that keeps answering it grows without bound. | **Fixed in S2.** `nr_send` reads the slot's queued bytes (`nish_uring_queued`) and copies at most what fits under `NR_AREA`, 256 KiB; a full area answers -11, and the slot is reported writable again once the kernel has taken enough, the descriptor contract. Before: S1's layer reported nothing, and with the bound mutated out the sink program's netWrite took all 64 MiB and never answered -11 ("netWrite took all 67108864 bytes and never answered -11"). After: "net_ring: writes to a peer that does not read answer -11 within the kernel's buffers and the send area, and every byte arrives", the first -11 after 4,172,800 bytes on 6.18.44. Tracked in #1648. |
| NURING-3 | Low | `runtime/runtime-uring.c` (`ur_complete`, `nish_uring_wait`) | A DATA event's bytes are the provided buffer the kernel filled, lent, not copied: they are given back to the kernel at the start of the next `nish_uring_wait`, and a caller that keeps the pointer past it reads bytes another connection's receive may have written. | **Decided.** The copy would cost every receive; the contract is in the header comment ("valid until the next wait"), and S2's surface copies the bytes into the program's array before the next wait. |
| NURING-4 | Low | `runtime/runtime-uring.c` (`ur_tag`, `nish_uring_close`) | A slot's generation is 24 bits, so a recv's completion that arrives after 2^24 closes of the same slot would match a newer connection's generation. | **Decided.** `nish_uring_close` cancels the slot's recv before it closes it, in the same submission, so no recv of the slot outlives the close by more than one completion; 2^24 closes and re-accepts of one slot in that window cannot happen. |
| NURING-5 | Low | `runtime/runtime-uring.c` (`ur_complete`) | A send the kernel answers with 0 bytes, for a record with bytes left, is taken as complete, and the bytes left are not sent. | **Decided.** A stream socket's send does not answer 0 for a non-empty buffer; re-arming on 0 would spin on a kernel that did. The connection's next send or recv reports any real failure. |
| NURING-6 | Low | `runtime/runtime-uring.c` (`ur_top_up`, `nish_uring_full`), `runtime/runtime-net.c` (`nr_accept`) | A set whose every ring is full and that cannot open another (`ur_add_ring` answers `-ENOSPC` at `rings_max`, or its setup fails for want of memory or descriptors) stops queuing accepts and says nothing: no event tells the caller, so new peers wait in the listener's backlog until the kernel drops them there. No connection already accepted is lost. | **Fixed in S2.** `nish_uring_full` answers whether the set can take no more, and `tcpAccept` on a ring listener with nothing accepted answers -23 (`ENFILE`) then, not -11, without dropping or closing an accepted connection; a close frees the slot and accepting goes on. Before: S1 had no answer to give. After: "net_ring: a full set answers -23, a closed handle -9, and the freed slot is taken again", under a descriptor limit of 32, where the set's rings cannot grow. Tracked in #1648. |
| NURING-7 | Medium | `runtime/runtime-uring.c` (`nish_uring_wait`, `ur_top_up`) | A wait serviced each ring and submitted that ring's own queue, but an accept or a close on one ring can move the accepting job to a ring the wait already passed (or will not reach: `cap` full, or not ready). That ring's new accepts sat in user space while the caller slept on `nish_uring_fd`, which nothing would signal: new peers waited in the backlog until some other event woke the caller. A peer cannot cause it alone, but any server whose set grows past one ring could stop accepting. | **Fixed before landing**: `nish_uring_wait` hands every ring's queued submissions to the kernel before it returns or sleeps (`ur_submit_queued`), so a wait returns with nothing queued unless the kernel refuses the submission (-EBUSY while completions overflow, which leaves completions for the eventfd to signal, or a transient -EAGAIN or -ENOMEM); the next wait submits it again. Before: "uring: runtime-uring.c move" failed on every run (5 of 5 on 6.18.44) with "a wait returned 1 events with 1 submissions still queued on ring 0". After: "uring: runtime-uring.c move: an accept or a close that moves the accepting job to a ring the wait passed leaves nothing queued in user space when the wait returns". |
| NURING-8 | Medium | `runtime/runtime-uring.c` (`nish_uring_wait`, `nish_uring_fd`, `nish_uring_sleep_ms`) | The layer and its callers slept on the set's epoll descriptor and trusted each ring's eventfd to say the kernel had queued work. On CI's kernel (7.0.0-1019-azure) a client's accept completed in the kernel and waited as deferred task work, with IORING_SQ_TASKRUN up, while the eventfd was never signalled: the caller slept with a peer accepted but not reaped. The mechanism, at v7.0: `io_req_local_work_add` signals the eventfd only when the task-work list was empty (`io_uring/tw.c:223-236`), and a signal raised in a nested context is deferred by `__io_eventfd_signal`, which first sets `IO_EVENTFD_OP_SIGNAL_BIT` with `atomic_fetch_or` (`io_uring/eventfd.c:53-64`, line 59) and skips the signal if the bit was already set; `io_eventfd_do_signal` (`eventfd.c:42`) signals and never clears it, and only registering the eventfd again resets `ops` (`eventfd.c:153`). After the first deferred signal every later one is lost, for the life of the registration. 6.1 clears the bit (`atomic_xchg(&ev_fd->ops, 0)` in `io_eventfd_ops`, `io_uring/io_uring.c:495`) and signals and wakes on every first add (`io_uring.c:1108-1128`). No other kernel wake is sure: the submitter is woken only when `nr_tw >= cq_wait_nr`, and outside `io_uring_enter` that is `IO_CQ_WAKE_INIT` (`io_uring.c:250`); polling the ring's own descriptor sleeps on `poll_wq` (`io_uring_poll`, `io_uring.c:2240-2276`), which only `__io_commit_cqring_flush` wakes when completions post (`io_uring.c:478-485`), and under DEFER_TASKRUN they post only when the submitter runs the task work; re-registering the eventfd each wait would cost two syscalls a wait and still leaves no way to see the bit. A peer cannot cause it alone, but any server could stop accepting until another event woke it. | **Fixed before landing**: no sleep on a ring set is longer than `UR_SLEEP_MAX_MS` (10 ms), so the hrtimer is the wake the kernel guarantees, on every version. `nish_uring_wait` sleeps for `nish_uring_sleep_ms`, which answers 0 while a ring is flagged IORING_SQ_TASKRUN or IORING_SQ_CQ_OVERFLOW, has completions not reaped, or has parked recvs, stalled sends or lent buffers that a free submission queue could take, and otherwise the caller's timeout capped at 10 ms; a wait of -1 that wakes with nothing goes round again, and every wake services every flagged ring, ready or not. `nish_uring_fd`'s contract says a caller that sleeps on the descriptor, alone or beside other sources, sleeps no longer than `nish_uring_sleep_ms` answers and then waits with 0. S2's `pollWait` over rings must keep the rule. Cost, measured on 6.18.44 (one-ring set, idle, 3 runs of 5 s, 4-core container): 98.6 to 98.8 wakes a second, 0.348% to 0.365% of one core, 35 to 37 µs a wake; a busy set never reaches the bound. Before, on 7.0.0-1019-azure (CI shard 5, job 133074815366): "uring-test: ring 0: live 1 accepting 1 to_submit 0 sq_flags 0x4 sq head 3 tail 3 cq head 1 tail 1 efd readable 0", fdinfo showing the accept (op 13) in the poll list and no overflow. After: "uring: runtime-uring.c nowake: a client that connects while a wait of -1 sleeps on a ring whose eventfd is gone is accepted by the sleep's bound (NURING-8)", which unregisters the eventfd to stand for the lost signal; a mutant whose `nish_uring_sleep_ms` answers the caller's timeout hangs it to its 10 s alarm on 6.18.44. The "move" check sleeps on `nish_uring_fd` for as long as `nish_uring_sleep_ms` answers. |
| NURING-9 | Medium | `runtime/runtime-net.c` (`nr_dispatch`, `nr_read`), `runtime/runtime-uring.c` (`ur_complete`) | A slot's multishot receive goes on taking a peer's bytes whether the program reads them or not, and each wait copies them into the slot's receive queue so the ring's buffer can go back. A peer that writes faster than the program reads, or a program that reads one connection while another floods, grew that queue without bound: the kernel's socket buffers never filled, so TCP never told the peer to stop. Found in S2's review. | **Fixed in S2.** Once a slot has `NR_AREA` (256 KiB) queued, `nish_uring_hold` cancels its receive by the receive's tag, so the slot's sends in flight go on, and the kernel's buffers fill and stall the peer; a read that takes the queue below 128 KiB lets the hold go and arms the receive again. A queue past `NR_RECV_MAX` (16 MiB), which only bytes already in flight when the hold lands could reach, ends the connection with -105 (`ENOBUFS`) as a backstop. Before (the hold mutated out): "flood: 67108864 bytes before the stall", the peer's 64 MiB all taken in, and the backstop then ended the connection with "read 16777196 bytes of 67108864". After: "net_ring: a peer the program does not read stalls within the kernel's buffers, and every byte arrives once it reads", the peer stalling after 4,849,664 bytes on 6.18.44 and all 64 MiB read. |
| NURING-10 | Medium | `runtime/runtime-net.c` (`nr_dispatch`, `nr_pump`, `nr_close`) | A close with sends queued lingers until the kernel has taken them, but the linger also ended on any hang-up, and a peer's FIN is a hang-up with no error: it only says the peer has stopped sending. A client that sent its request and shut its writing side, as HTTP/1.0 clients and `shutdown(SHUT_WR)` do, got a response cut short by whatever was still queued, up to the 256 KiB send area. Found in S2's review. | **Fixed before landing**: only a hang-up with an error ends a linger; a FIN leaves it to finish the queue. Before (the check mutated back): "received 4005888" against "wrote 4268032" bytes, short by exactly the send area. After: "net_ring: a close after the peer's FIN still sends every queued byte, and a closed loop lets its slots go". |
| NURING-11 | Low | `runtime/runtime-net.c` (`nr_ctl`, `nish_net_close`) | A ring slot added to a loop is registered to that loop's number, and closing the loop's descriptor did not let the registration go: the slot answered `pollAdd` -17 (`EEXIST`) on any other loop, and a later loop given the same descriptor number would have been told of the slot's readiness without adding it. Found in S2's review. | **Fixed before landing**: the layer notes each loop a slot or listener is added to, and closing one of those descriptors drops every registration to it, as the kernel's epoll does for a closed epoll descriptor. Before (the forget mutated out): "a slot of a closed loop answered pollAdd -17". After: the same `net_ring_halfclose` check, whose program closes a loop holding the slot and adds the slot to a new one. |
| NURING-12 | Low | `runtime/runtime-net.c` (`nr_close`, `nr_pump`) | A lingering close has no deadline. A peer that keeps its receive window shut holds the slot and up to 256 KiB (`NR_AREA`) of unsent bytes after the program has closed it, for as long as the connection lives. The pool buffers carrying them come to at most 23, 368 KiB, by NURING-44's reading of the code, which no check measures. A ring whose slots all linger so holds up to its slot count times that: 11.5 GiB at the 32,768 slots a ring the handler-ring bench opens, a figure read, not run. | **Open.** It is bounded: one send area per slot, over the slots a set has, and a set that can open no more slots ends every lingering close to free them, so such peers cost memory but not new connections. A deadline would close the slot with its queue unsent, which is what a descriptor's close does when its `SO_LINGER` runs out; it is not done. |
| NURING-13 | Low | `runtime/runtime-uring.c` (`ur_top_up`), `runtime/runtime-net.c` (`nr_dispatch`) | The set keeps accepts queued whether or not the program calls `tcpAccept`, so peers leave the listener's backlog as soon as they connect and wait in the set, each with a slot and a receive that takes up to 256 KiB (NURING-9's hold) before the program has accepted it. The backlog `tcpListenFlags` was given no longer bounds the peers a slow program holds. | **Open.** It is bounded by the slots a set can open, and a full set stops accepting (NURING-6). Holding accepts to the number of `tcpAccept` calls outstanding would give the backlog back its meaning at a submission per accept; it is not done. |
| NURING-14 | Low | `runtime/runtime-net.c` (`nr_poll_wait`) | io_uring's task work interrupts `epoll_wait` with `EINTR` as a signal does, so once the process has opened a ring listener, for the rest of its life, `pollWait` cannot tell a signal from the rings' own work: it goes on waiting to its deadline, where without rings it answers 0. | **Decided.** Answering 0 on every task-work wake would end waits early for no cause. `pollWait`'s contract in `runtime/nish.d.ts` and `docs/LANGUAGE.md` says a process that has opened a ring listener sees a signal through `signalFd()`, which a server watches already. |
| NURING-15 | Low | `runtime/runtime-net.c` (`nr_open`) | A process opens at most 31 ring listeners in its life: a closed listener's set entry is not reused, so the 32nd `tcpListenFlags` with `NET_LISTEN_RING` answers -23 however many are open. A program that opens and closes ring listeners in a loop runs out. Found in S2's review. | **Decided.** A server opens its listeners once; reusing an entry would have to prove no handle of the old set is still held, since a handle names its set by index. The limit is in `tcpListenFlags`'s contract (`runtime/nish.d.ts`) and the networking guide. |
| NURING-16 | Low | `runtime/runtime-net.c` (`nish_net_raise_nofile`, the `NR_BASE` tests) | Slot handles start at 2^20, and the runtime raises the descriptor limit no higher than that, but a process that inherits a soft limit above 2^20 keeps it, and the kernel could then hand out a real descriptor at or above 2^20 that the network calls take for a slot handle. Found in S2's review. | **Decided.** The kernel hands out the lowest free descriptor, so it takes over a million open descriptors before one reaches 2^20; `fs.nr_open` defaults to 2^20 on Linux, so a limit above it needs a raised sysctl as well. Lowering an inherited limit would take descriptors from a program that asked for them. |
| NURING-17 | Low | `runtime/runtime-net.c` (`nr_note_loop`, `nr_forget_loop`) | The layer tracks up to 64 loops a slot or listener was added to; past that it marks the table spilled, and from then on, for the rest of the process's life, every descriptor close scans every set's slots for registrations to it. Found in S2's review. | **Decided.** A cost, not a fault: the scan is bounded by the slots the sets hold and finds the registrations a closed loop leaves, which NURING-11 requires. A program with more than 64 loops holding ring handles at once is not one S2 serves. |
| NURING-18 | Medium | `runtime/runtime-net.c` (`nr_poll_wait`) | A wait took the loop's ready slots first and called `epoll_wait` only with the room they left, so once a loop held as many slots ready as the wait could report, 64 or fewer when its array is smaller, it never asked the epoll set: a descriptor in the same loop, `signalFd()` among them, was never reported while the slots stayed ready, which a slot that can be written to always is. That broke what NURING-14 rests on. Found in S2's second review. | **Fixed before landing**: when the slots fill the batch, the epoll set still gets half of it, or every other wait when there is room for one entry, and the slots it displaces stay listed for the next wait. Before (the share mutated out): "with 80 slots ready, 4 waits with room for 64 never reported the descriptor". After: `net_ring_starve`, which holds 80 slots ready to write beside one connecting descriptor and requires the descriptor within four waits with room for 64, then for one, and a slot as well. |
| NURING-19 | Low | `runtime/runtime-net.c` (`nr_dispatch`) | When the table for a new ring, or the larger accept queue `nr_dispatch` grows into, cannot be allocated, the accepted slot is closed at once, and a close that finds the submission queue full after flushing it answers -11, which is dropped: the slot stays open in the ring, unreachable, until the listener is closed. Found in S2's second review. | **Decided.** It needs a failed allocation and a queue still full after `nish_uring_close` has submitted it, which leaves room as soon as the kernel takes the entries; one slot is held, and the set's close releases it. Queueing the close would need memory in the path that ran out of it. |
| NURING-20 | Low | `runtime/runtime-net.c` (`nr_open`, `nr_refused`) | The first ring listener's failure to open rings was latched as the process's answer whatever it was, both from the probe and from the first set's open, so a transient failure, such as -24 when the descriptor table was full or -12 when locked memory was short, left every later listener on descriptors and `netRingState()` at that answer for good. Found in S2's second review for the open, and in its third for the probe. | **Fixed before landing**: on both paths only a refusal is latched, -1, -38, -22 or -95, the answers `netRingState()` documents and `nish_uring_probe` keeps; any other failure leaves the state at 0, and a later listener asks again. Tested by `net_ring_transient`: under `ulimit -n 32` with one descriptor free, the probe answers -24, and `netRingState()` must stay 0 and the next ring listen open rings; before the fix the state stayed -24 and the check failed. |
| NURING-21 | Low | `runtime/runtime-net.c` (`nish_net_write2`) | `netWrite2` on a slot with an empty first range and a full send area answered 0, where a descriptor's `sendmsg` answers -11, so a program that waits on -11 took it for a written nothing and spun. Found in S2's third review. | **Fixed before landing**: with nothing of the first range sent, the second range's answer is the call's, -11 included. Tested by `net_ring_sink`, which at its first -11 calls `netWrite2` with an empty first range and requires -11; before the fix it answered 0 and the check failed. |
| NURING-22 | Low | `runtime/runtime-net.c` (`nr_open`) | Once rings were open, a later ring listener whose own set's open failed for any reason other than a refusal, such as -24 when the descriptor table was full or -12 when locked memory was short, failed `tcpListenFlags` with that errno, where §5.4 of the design and the probe's own path fall back to descriptors. Found in S2's fourth review. | **Fixed before landing**: every failure of a set's open falls back to descriptors, as the probe's does; only a refusal before any set has opened decides the process's state, and -23 past the 31st set stays the call's answer. Tested by `net_ring_transient`, which with rings open fills the descriptor table again but for one and requires a third ring listen to succeed with `netRingState()` still 1; before the fix it answered -24 and the check failed. |
| NURING-23 | Low | `runtime/runtime-net.c` (`nr_send`) | `netWrite` on a slot whose peer had reset it queued the bytes and answered their count, where a descriptor's `send` answers -104 or -32: only a failed send of the slot's own was checked, not a receive's error. A program that writes without reading took a gone peer for a live one until its send area filled. Found in S2's fourth review. | **Fixed before landing**: a failed slot, by a receive's error or a send's, answers `netWrite` and `netWrite2` with that errno. Tested by `net_ring_reset`: the client sends five bytes and resets, the program reads until `netRead` answers the reset, and `netWrite` must then answer an errno; before the fix it answered 64 and the check failed. |
| NURING-24 | Low | `runtime/runtime-net.c` (`nr_read`) | A slot's receive error is answered by every `netRead` once its queued bytes are read, `len` 0 included, where a descriptor's `recv` answers `ECONNRESET` once and then 0. Found in S2's fourth review. | **Decided.** The error stays the slot's answer: it is what `nr_failed` keeps for the poll loop's error bit, the lingering close and `netWrite` (NURING-23), and answering 0 after it would tell a second reader the peer ended cleanly. A program that stops at the first negative answer, as the readiness contract asks, sees the same on either. Documented in `docs/LANGUAGE.md` and the guide. |
| NURING-25 | Low | `runtime/runtime-net.c` (`nr_ctl`) | A slot handle is in one poll loop at a time: `pollAdd` of a slot another loop watches answers -17, where epoll lets one descriptor be watched by several loops. Found in S2's fourth review. | **Decided.** A slot's readiness lives in one registration, and a server watches each connection in one loop; the second loop's add is refused, not half kept. Documented in `runtime/nish.d.ts` (`pollAdd`, `NET_LISTEN_RING`), `docs/LANGUAGE.md` and the guide. |
| NURING-26 | Low | `runtime/runtime-net.c` (`nr_open`) | `netRingState()` went to 1 as soon as the probe passed, before the first set had opened, so a first set whose open then failed for want of a descriptor left rings decided with none open: every later ring listener tried rings again and none fell back for the life of the process. Found in S2's fifth review. | **Fixed before landing**: the state goes to 1 only once a set opens, and a set-open failure at state 0 that is a refusal latches that refusal's own errno (-1, -38, -22 or -95); any other leaves it 0. Before: `transient.ts`'s second step failed with "the listen answered 30 and netRingState() 1". After: "net_ring: a probe or first set that fails for want of a descriptor is not kept, the next ring listen opens rings, and a later set that fails for one falls back". |
| NURING-27 | Low | `runtime/runtime-uring.c` (`ur_arm`, `ur_complete`, `nish_uring_hold`), `runtime/runtime-net.c` (`nr_dispatch`) | A slot whose receive a reset ended was armed again when a hold let it go, and its next receive's completion reported a second hangup, `res` 0, over the first: the slot's `-104` became an end of stream, and a program that read on saw a reset peer close cleanly. Found in S2's fifth review. | **Fixed before landing**: the terminal hangup marks the slot `ST_HUP`, which only an accept into the slot clears, and `ur_arm` arms no slot that carries it. In `nr_dispatch` the first hangup's `res` is kept and data after a hangup is dropped; those two guards cover a kernel hangup after a local -105 or -12, which no test can force, and are not tested apart. Before: with both reverted, "uring: runtime-uring.c hupheld" failed with "after the hangup and a hold let go, an event of kind 3 res 0". After: "uring: runtime-uring.c hupheld: a slot whose recv a reset ended, held and let go, arms nothing and reports no second hangup (NURING-27)". The link-level program first written for it never failed with the fix reverted, since on 6.18.44 the hold's cancel always reaches the kernel before the reset's completion, and was dropped. |
| NURING-28 | Medium | `runtime/runtime-uring.c` (`ur_transient_accept`, `ur_complete`), `runtime/runtime-net.c` (`nr_dispatch`, `nr_accept`) | An accept completion with an error other than `EAGAIN`, `EINTR`, `ECONNABORTED` or `EPROTO` stops the set accepting for good: `tcpAccept` on that listener answers the errno from then on, where a descriptor listener's `accept` answers each error once and a later call may succeed. That set includes `-ENOMEM` and `-ENOBUFS`, which are transient memory pressure: a resubmit would succeed once memory frees, and a descriptor listener recovers from them. A remote peer that drives the host into memory pressure, for instance with many connections each holding unread receive bytes (NURING-13), can so stop the listener, which the threat model's "stop it accepting" names. Found in S2's fifth review; its first reason, that these errors mean the set is broken, was found false in the sixth. | **Fixed before landing.** `ur_pressure_accept` takes `-ENOMEM` and `-ENOBUFS` as memory pressure: the set reports a `NISH_URING_ACCEPT_PAUSED` event once, submits no accept until a back-off of 10 ms, doubling to 640 ms while the pressure recurs and reset by the next accept that succeeds, has passed, and `nish_uring_sleep_ms` wakes its caller when it ends. Accepts already in flight stay with the kernel. `tcpAccept` answers the errno once, as a descriptor's `accept` does, then `-11` while paused (`nish_uring_full` is 0), then connections again. `EBADF`, `EINVAL` and `ENFILE` past the registered table do mean the listener or the set is broken and stay terminal. Before/after: `uring: runtime-uring.c nomem` turns two accept completions into `-ENOMEM`; before, the first came as `ACCEPT_FAILED` and the set stopped (`client 1's -ENOMEM came as kind 5 res -12, not a pause with -12`); after, each pauses once, the second with twice the first's back-off, a paused set does not ask for a wait at once, and the next client is accepted. The net side's once-only answer has no test of its own: a program cannot make the kernel answer `-ENOMEM`. |
| NURING-29 | Low | `runtime/runtime-net.c` (`nr_encode`, `nr_decode`) | A slot handle carries its slot's generation in the bits the ring and slot indices leave, G = 2^20 / slots values, never fewer than 64. A stale handle answers `-EBADF` only until its slot has been reused G times; after that its generation matches again and it reaches the newer connection on that slot. Found in S2's sixth review. | **Decided.** A descriptor number is reused at the very next open, so a slot handle is already stricter than the descriptor a fallback listener hands out, and a program that uses a closed handle is in error either way. Widening the handle past 32 bits would change `tcpAccept`'s result type. The "Stale handles" checks below cover reuse within one generation. |
| NURING-30 | Low | `runtime/runtime-uring.c` (`ur_make_ring`) | A restricted ring is made with `R_DISABLED`, `COOP_TASKRUN`, `TASKRUN_FLAG`, `SUBMIT_ALL` and `CQSIZE`, without `SINGLE_ISSUER` or `DEFER_TASKRUN`: `--sandbox` makes it on the main thread before any other runs, and a listener may take it on another, which `SINGLE_ISSUER` would refuse. So the kernel no longer enforces one submitting thread (the design's D3); the layer alone holds it, by the set's owning thread. A completion's task work runs on the submitting thread at its next transition, as `COOP_TASKRUN` sends it there, not only inside `io_uring_enter`; behaviour 4's cap of 20 completions an enter, which is `DEFER_TASKRUN`'s, does not apply; and a wait can still answer `-EINTR`, which the layer retries. | **Decided.** The alternatives make the ring on the thread that will use it, which needs `io_uring_setup` after the filter, the call S3 exists to kill, or tie `--sandbox` to one listening thread. Every property below holds on a restricted ring: "sandbox: a sandboxed NET_LISTEN_RING listener serves a loopback connection through a premade ring" runs the layer's accept, receive, send and close on one, and the `destroy` note's premise is restated for it there. |
| NURING-31 | Low | `runtime/runtime-uring.c` (`nish_uring_premake`, `ur_add_ring`), `runtime/runtime-net.c` (`nish_net_ring_premake`, `nr_open`) | A sandboxed process holds a fixed capacity: `nish.netRings` rings (default 1, at most 64) of the soft `RLIMIT_NOFILE` slots read at preinit, before `nish_net_raise_nofile` raises it, capped at 16,384. A set that fills them stops growing and `tcpAccept` answers -23, as NURING-6's full set does; a ring a closed listener held is freed, not given back; and a ring listener opened once the pool is spent falls back to descriptors. A peer can fill the capacity as it can fill any set's. | **Decided** (the design's D2): the program names its capacity in `package.json`, and NL3058 refuses a count outside 1 to 64. Giving a ring back would need its registered table and buffer ring cleared under restrictions that refuse `io_uring_register` after enabling. Tests: "net_ring: under --sandbox a full set of premade rings answers -23 and makes no ring past them", and "sandbox: `nish.netRings` 3 premakes 3 rings". |
| NURING-32 | Low | `runtime/runtime-sandbox.c` (`nish_sandbox`), `runtime/runtime-uring.c` (`nish_uring_premake`) | The rings are made in `.preinit_array`, before `main`, and their memory (each ring's SQ and CQ, its file table and 1,024 buffers of 2,048 bytes) is held for the life of the process, used or not. A failure there prints nothing and does not stop the program: it leaves the pool at that step's errno. | **Decided.** A sandboxed program that cannot have rings runs on descriptors, which is §5.4's fallback for every ring listener, and `netRingState()` answers the errno, so the cause is visible without a message on every start. Test: "sandbox: on a kernel that refuses DEFER_TASKRUN no ring is premade and the probe answers EINVAL (NURING-33)" reads the answer of a premake that failed. |
| NURING-33 | Medium | `runtime/runtime-uring.c` (`nish_uring_premake`) | A premade ring is made by `ur_make_ring` without `SINGLE_ISSUER` and `DEFER_TASKRUN` (NURING-30), and `nish_uring_probe` answers the pool's count under `--sandbox` without calling `ur_probe_once`. So nothing held a sandboxed process to the probe's floor: a 5.19 or 6.0 kernel, which has `R_DISABLED`, `SUBMIT_ALL`, `COOP_TASKRUN`, sparse `FILES2` and `PBUF_RING` but not `DEFER_TASKRUN`, made restricted rings and served on them, and reached CVE-2023-0469 (fixed in 6.1, in `ACCEPT` and `CLOSE` on direct descriptors), which "The kernel's record" puts below the floor. Found in S3's review. | **Fixed before landing**: `nish_uring_premake` runs `ur_probe_once` before it makes a ring, and a probe that fails leaves the pool at its errno, so a sandboxed process takes the same kernels an unsandboxed one does. Before: with the probe call removed, a build whose `UR_SYS_SETUP` refuses `DEFER_TASKRUN` as 6.0 does premade its ring ("ring-count: 1"). After: "sandbox: on a kernel that refuses DEFER_TASKRUN no ring is premade and the probe answers EINVAL (NURING-33)". |
| NURING-34 | Medium | `runtime/runtime-uring.c` (`ur_add_ring`) | A set takes a premade ring by `__atomic_fetch_add` on the pool's `next`, and answered `-ENOSPC` once that passed the count, but still counted. `ur_top_up` asks for a ring each time a full set's accepting ring has no room, which a peer holding every slot makes happen on every wait and completion, so the counter grew without bound: past 2^31 asks it overflowed, a signed overflow, and a negative `next` indexed `rings[]` before its start and handed the set a pointer from outside the pool. Found in S3's review. | **Decided, untested.** `ur_add_ring` reads `next` first and answers `-ENOSPC` without counting once the pool is spent, so `next` passes the count by at most the threads that raced to it. No test makes 2^31 asks, and "net_ring: under --sandbox a full set of premade rings answers -23 and makes no ring past them", which pins the spent pool's answer, passes on the code before the guard too: the guard is read, not tested. A hook that set the counter near `INT32_MAX` would test it, at the cost of a test-only entry point in the runtime. |
| NURING-35 | High | `runtime/runtime-sandbox.c` (`nish_sb_seccomp`) | Under `--sandbox` with `net` and without `process.spawn`, the filter let `io_uring_enter` through on any descriptor, so the restrictions that hold the premade rings to six operations held only those rings. A ring made by an unconfined process, with no restriction, so every operation (`OPENAT`, `CONNECT`, `SENDMSG`, which seccomp's rows for the matching system calls never see; Landlock's rules still apply), entered the sandboxed process by inheritance across `exec`, since Linux 6.7 refuses to pass an io_uring descriptor over `SCM_RIGHTS`, and `io_uring_enter` drove it. A program granted `net` and withheld `process.spawn` with no ring listener got `io_uring_enter` as well, with no ring to use it on. Found in S3's review. | **Fixed before landing**: `nish_uring_premake` writes each ring's descriptor back, and the filter compares `io_uring_enter`'s first argument, the low word of `args[0]` (the kernel's `unsigned int fd`), with each and kills on any other; with no ring made, `io_uring_enter` kills like the other two calls. Before: with the filter letting `io_uring_enter` through by number alone, "sandbox: a ring a parent made unconfined and passed across exec cannot be entered: SIGSYS" answered `foreign-enter: ok` in both modes, and the two "io_uring_enter from ffi with net … dies of SIGSYS" checks answered `Bad file descriptor` from the kernel. After: all three die of SIGSYS, and the control, "sandbox: without --sandbox a ring inherited across exec is entered", shows the fixture enters the ring when no filter stands in the way. |
| NURING-36 | Medium | `runtime/runtime-sandbox.c` (`nish_sb_seccomp`, `nish_sb_fd_row`), `runtime/runtime-uring.c` (`ur_free_ring`, `ur_make_keeper`, `nish_uring_premake`) | The filter matches `io_uring_enter`'s descriptor number, not the file behind it. Code in the process that holds a foreign ring, inherited across `exec` as NURING-35 describes, can `dup2` or `dup3` it onto a premade ring's number, which closes the premade ring's descriptor and puts the foreign one there, or onto a number a closed ring listener freed, since `ur_free_ring` closes its ring's descriptor and the number stays on the filter's list. Plain `dup` and `fcntl(F_DUPFD)` reach the same freed number without naming it: each takes the lowest free descriptor, so closing a premade ring's descriptor, or a ring listener's, and duplicating the foreign ring puts it at that number. `io_uring_enter` on that number then drives an unrestricted ring. Found in S3's review, while fixing NURING-35; recorded open there, and closed by issue #1690's follow-up. | **Fixed** (2026-11-17). The filter cannot see the file behind a number, so it keeps each number on its ring. `nish_uring_premake` makes one ring more, the keeper, with `R_DISABLED`, restricted to `NOP`, then enabled, and never mapped or entered: the filter's `io_uring_enter` row does not list it. In the ring block (`net` without `process.spawn`, rings made), `close` with a ring's or the keeper's number as `args[0]` kills, as do `dup2` and `dup3` with one as `args[1]`, the number they replace; `dup3` whose source is the keeper is let through, and `ur_free_ring` drops a pooled ring with `dup3(keeper, fd, O_CLOEXEC)`, which replaces the ring with the keeper in one step, so a freed number still names a ring that takes only `NOP`. `close_range` answers `ENOSYS`, as a kernel before 5.9 does, so a range close cannot pass a ring's number by the `close` row. `dup`, `fcntl(F_DUPFD)`, `recvmsg` with `SCM_RIGHTS` and `pidfd_getfd` (killed in any case) take a free number, which a ring's never is, and `execve` and `execveat` are killed without `process.spawn`. `IORING_OP_CLOSE`, which the restriction allows, is refused by the kernel on an io_uring file (`io_uring/openclose.c`, `io_close`, EBADF). Descriptor-handling programs keep `dup2`, `dup3`, `close` and `F_DUPFD` on every other number. Before: with the rows removed and `ur_free_ring` closing its descriptor, each swap check answered, in both modes, `<op>: the foreign ring is at ring 0's number` and entered it (`dup3-ring: ok`, `dup2-ring: ok`, `close-dup: ok`), the freed-ring check answered `freed-dup: the duplicate took ring 0's number; the number holds the foreign ring` then `freed-dup: ok`, and `close_range` answered `ok`. After: "sandbox: dup3 of an inherited ring onto premade ring 0's number dies of SIGSYS (NURING-36, strict)", its `dup2` (x86-64) and `close` + `F_DUPFD` siblings, "sandbox: a ring a closed listener freed keeps its number on the keeper, and a duplicate takes another (NURING-36, strict)", "sandbox: close_range over a premade ring's number answers ENOSYS", "sandbox: io_uring_enter on the keeper's number dies of SIGSYS", and "sandbox: IORING_OP_CLOSE of a premade ring's own number answers EBADF" with the keeper's beside it, each in best-effort too. Controls: "sandbox: IORING_OP_CLOSE of a pipe's descriptor closes it (the control)" and "sandbox: dup2, dup3, close and F_DUPFD on descriptors that are no ring work (the control)". Costs: the keeper is one more descriptor and one small ring for the life of the process (`ring-count` reads 2 for one ring), and a program that calls `close_range` itself or closes every descriptor by number under a ring listener sees `ENOSYS` or dies; Nish's runtime does neither. The rings are made by `io_uring_setup`, which takes the lowest free number, and nothing reserves 0, 1 and 2 first, so a process started with one of them closed can have a premade ring or the keeper there, and a later `close`, `dup2` or `dup3` on that number, a redirection or a `netClose(n)` on a stale number (`nish_net_close` falls through to `close`), dies of SIGSYS. `ur_free_ring` tries its `dup3` again on `EINTR` and `EBUSY`; any other failure leaves the freed ring at its number, still restricted, with its kernel memory held for the life of the process. |
| NURING-37 | Low | `runtime/runtime-net.c` (`nr_open`), `runtime/runtime-uring.c` (`nish_uring_premake`) | Under `--sandbox` the first ring listener's failure is latched whatever it is: `nr_open` latches any failure when `pooled` is set, so a transient first-open failure, `epoll_create1` answering `-EMFILE` or `calloc` `-ENOMEM`, taken before any ring was used, leaves every later listener on descriptors for good, and `nish_uring_premake` latches a transient probe errno at start the same way. That is the reverse of NURING-20's rule, under which any failure but a refusal leaves the state at 0. A count of 0, a sandbox that made no ring because `main` cannot reach `NET_LISTEN_RING` or `net` was withheld, answers `-EPERM`, the same as a kernel whose seccomp refuses `io_uring_setup`. Found in S3's review. | **Decided.** Under the filter no ring can be made later, so a pool that failed has nothing to retry with: asking again could only repeat the answer. The premake runs once, in `.preinit_array`, before the program can have filled its descriptor table or its memory, so the transient answers it can meet are the host's, not the program's. `-EPERM` for a count of 0 is the documented "rings not permitted" answer, which is what the sandbox means there; `netRingState()` callers that need the cause read `--sandbox`'s grants. |
| NURING-38 | Low | `runtime/runtime-net.c` (`nr_read`, `nr_dispatch`'s receive) | A slot's receive queue was allocated at 4,096 bytes on its first receive and kept until the program closed the connection (`nr_close` frees it, so a reused slot starts with none). Every keep-alive connection that had sent one request and was waiting for the next held a queue with nothing in it: 4 KiB and malloc's overhead each, a total a peer sets by opening and idling connections, bounded only by the slots (16,384 a ring) times the largest queue each had grown to while it was open, up to `NR_RECV_MAX`. At 96,000 connections under the handler it was most of a ring process's 518 MB PSS against 129 MB for five epoll processes (WP63 S4). | **Fixed after landing**: `nr_read` frees a queue it drains (`roff == rlen`) and zeroes `rbuf`, `rcap`, `roff` and `rlen`, so `roff == rlen` holds only at 0 and the receive's own reset of a drained queue is gone; a first queue is 1,024 bytes (`NR_RECV_FIRST`), doubled as it fills, inside glibc's thread cache. A read after the free finds nothing queued (`have` is 0) and answers -11, the hang-up or the write error without touching the buffer; a close or a listener's close after it calls `free(NULL)`; the next receive `realloc`s from NULL; the queue is compacted only when `roff` is past 0, which a freed queue's is not. The hold at `NR_AREA` and the `NR_RECV_MAX` backstop are unchanged, so a slot whose program does not read still grows as NURING-9 bounds it. The cost is an allocation and a free per drained read. Before: "idle: 4894 bytes per connection". After: "net_ring: an idle keep-alive slot holds no receive queue: under 1,536 bytes a connection at 3,000 (NURING-38)", about 800 bytes a connection on 6.18.44, all of it the ring's provided buffers and the slots' table. |
| NURING-39 | Medium | `runtime/runtime-uring.c` (`ur_restrict`, `ur_ops_ok`, `ur_send_head`, `ur_complete`, `nish_uring_shutdown`, `nish_uring_close`), `runtime/runtime-net.c` (`nr_shutdown`, `nish_net_shutdown`, `nish_net_mss`) | A slot had no half-close: `netShutdown` on a slot answered -9, so `Http1Server`'s lingering close, which shuts its writing side and drains the client's bytes before it closes, closed at once on a ring listener, and a client still sending got a reset in place of the refusal it had been sent. A slot path needs `IORING_OP_SHUTDOWN`, which the premade rings' restriction left out. Found while closing that gap, the kernel's handling of the new operation: `io_shutdown_prep` sets `REQ_F_FORCE_ASYNC`, so the request runs on an io-wq worker, which looks the fixed file up only when it runs (`io_wq_submit_work`, `io_assign_file`), and the close's `ASYNC_CANCEL` by `CANCEL_FD` compares the request's file, so it cannot match a shutdown that has none yet (`io_cancel_req_match`, Linux 6.18). A close with a shutdown in flight freed the slot to the accepting job, and a new connection accepted into it before the worker ran would have had its writing side shut. `SEND`, issued inline, resolves its file at submit and has no such window. | **Decided**: the restriction takes `SHUTDOWN` as a seventh operation, and the probe requires it (Linux 5.11, below the 6.1 floor). The restriction does not confine it to the table: its flags entry (`SQE_FLAGS_ALLOWED`) allows `FIXED_FILE` and requires nothing, and no `SQE_FLAGS_REQUIRED` entry is registered, so an SQE written into the ring by other means could name an ordinary descriptor, as it already could for `SEND`. What confines it is the layer: `nish_uring_shutdown` always sets `FIXED_FILE` and names only a slot of the ring's own registered table, a socket the program may already `CLOSE` through the same table; `how` past 2 answers -22 before anything is queued. The shutdown is queued on the slot's send list as a record of length 0, so the peer reads every byte written before it and then the end of the stream; `SHUT_WR` and `SHUT_RDWR` make a later `netWrite` answer -32, and `SHUT_RD` and `SHUT_RDWR` make `netRead` answer what is queued and then 0. The completion's result is not reported: a shutdown the kernel refuses, as on a peer already gone (`-ENOTCONN`), changes nothing a later read does not say, so a refused shutdown is silent. A stale handle answers -9 (`nr_decode`), and a record whose slot's generation has moved on is freed, not submitted. For the late file, **fixed before landing**: `nish_uring_close` answers `-EAGAIN` while any shutdown is at the head of the slot's queue, which `nr_close` already takes as a lingering close and retries each pump, so the slot is freed only after the worker has run. `netMss` on a slot answers -1, documented: io_uring's socket command reads only `SOL_SOCKET` options, so `TCP_MAXSEG` has no route through the ring; `Http1Server.accept` keeps an MSS only above 0, so a slot gets the compressor's own. The seccomp filter needs no row: it matches `io_uring_enter`'s descriptor number, which does not change, and the shutdown runs in the kernel's worker, not through the `shutdown` system call. Before: on the base runtime, `Http1Server`'s refusal on a ring listener reached the client as `ECONNRESET` after 103 bytes in 12 runs of 12, the client writing on after the end of the stream so that a server which closed rather than lingered answers with a reset whatever the timing; with `SHUTDOWN` left out of `ur_restrict`, the sandboxed client read no end of the stream within its 100 sends; with the close's guard removed, `uring: runtime-uring.c shutclose` answered "a close with the shutdown in flight was not refused". After: "net_ring: Http1Server's lingering close on a ring listener sends the whole refusal and then the end of the stream while the client still sends, not a reset (NURING-39)" and its `--sandbox` twin, the same program's checks that `netShutdown` with `how` 3 answers -22 and `netWrite` after the write side is shut answers -32, the `shutclose` mode, whose second client, accepted into the freed slot, reads no end of the stream, and "sandbox: a premade ring takes SHUTDOWN past its restriction". |
| NURING-40 | Medium | `runtime/runtime-uring.c` (`ur_mark`, `ur_send_marked`, `nish_uring_send`, `nish_uring_close`) | A slot's SEND is no longer written when `nish_uring_send` queues it: the slot is marked, and the ring writes the head's SEND, from its whole unsent length, at its next submit, so writes queued in between (a response's head and body, `netWrite2`'s two halves) join one record. Every record is a pool buffer of `UR_CHUNK_DATA` bytes. The append takes bytes into the slot's last record only while that record is not in the kernel (`in_flight`) and is not a shutdown, so no byte is written into memory the kernel is reading and bytes never pass a shutdown queued before them. It fills that record's room, first moving its unsent bytes to the front when the write does not fit; the rest goes into pool buffers chained behind it, each filled to at most `UR_CHUNK_DATA`, all of them taken before any byte is copied, so a write that cannot get them queues nothing and answers `-ENOMEM` (NURING-51). Each chained buffer is its own SEND. Found while building it: `nish_uring_close` cancels and closes the slot in the same submission and frees every record not in the kernel, so a slot closed right after a send, before the ring submitted, lost the deferred head that the S1 layer had already written. | **Fixed before landing**: `nish_uring_close` writes the slot's SEND first when its head is not in the kernel, asking room for three SQEs, so a close sends what the S1 layer sent before its cancel. Before: without that submit, "uring: runtime-uring.c bound" failed with "an echo never came back". After: the bound check passes; "uring: runtime-uring.c coalesce: a head+body response and three back-to-back writes each leave as one SEND (NURING-40)", which counts the ring's SENDs over 200 responses (2.00 a response before the send pool, 1.00 after); and "uring: runtime-uring.c inflight: writes behind a SEND in flight join one record and arrive in order across short sends (NURING-40)", which with the `in_flight` refusal removed from the append failed with "byte 3924720 arrived out of order"; and "uring: runtime-uring.c netwrite: netWrite2 through runtime-net.c's ring slots, and three back-to-back netWrites, each leave as one SEND (NURING-40)", which drives `nish_net_write2` itself over 200 responses and with a pump between its two halves failed with "a netWrite2 response took more than one SEND" (2.00 a response). With the shutdown refusal removed from the append, "uring: runtime-uring.c shutpool: 1,000 one-byte writes, each behind a repeated shutdown, hold at most five pool buffers (NURING-43)" failed with "the slot's queue did not drain"; with a chained buffer's copy not capped at `UR_CHUNK_DATA`, the `bigsend` mode (NURING-51) died of `SIGSEGV`. `NR_AREA` still bounds the queue: `nr_send` reads `nish_uring_queued`, which the append updates, and "net_ring: writes to a peer that does not read answer -11 within the kernel's buffers and the send area, and every byte arrives" passes. |
| NURING-41 | Low | `runtime/runtime-uring.c` (`ur_record`, `ur_release`, `ur_free_ring`) | Every send record is a 16 KiB pool buffer holding up to `UR_CHUNK_DATA` bytes (16,384 less the record's header), taken from its ring's free list or allocated; a write longer than one buffer's room takes as many as it fills (NURING-40, NURING-51), and a record is given back when the kernel has taken all of it, so a slot with nothing queued holds none. A free buffer is kept on the ring's list while it holds fewer than `UR_SENDPOOL_MAX`, 32, and freed past that: at most 512 KiB of cached buffers a ring, freed with the ring. A buffer a slot holds is not cached and is bounded by the slot's queue (NURING-43): a peer that does not read pins its slot's buffers, at most `NR_AREA` of bytes in them. Each response that fills more buffers than a ring caches allocates the rest: a 64 KiB response with its head fills 5, so a ring with 7 or more in flight at once (35 buffers) allocates past the 32 it keeps, and frees them when they return. | **Decided**: the cap trades at most 512 KiB a ring for no allocation on a steady connection whose responses in flight fit the cache. "uring: runtime-uring.c pool: a burst leaves no buffer on an idle slot and exactly UR_SENDPOOL_MAX cached, and steady responses allocate none (NURING-41)" reads the counters: 64 held in the burst, then 0 held and 32 cached, and no new buffer over the steady responses. With the cap removed from `ur_release` it failed with "the ring did not keep exactly UR_SENDPOOL_MAX of the burst's freed buffers". |
| NURING-42 | Low | `runtime/runtime-uring.c` (`ur_release`, `ur_complete`, `ur_drop_sends`) | A pooled buffer reused while the kernel still read it would put one connection's bytes in another's SEND. A record goes back to the pool only through `ur_release`, which `ur_unlink_all` calls when the record leaves the set's list: on the completion that takes its last byte, on a failed send's completion, or from `ur_drop_sends`, which skips a record in flight; a closed slot's in-flight record is freed by its own completion, as NURING-1 left it. | **Decided**: the pool adds no path that frees a record in the kernel. "uring: runtime-uring.c reset: a send the peer resets fails once as SEND_FAILED, and its record is freed once" runs the failed send's path on a pooled record; no check reuses a buffer while a SEND in flight still names it, so the order is read, not tested, beyond that. |
| NURING-43 | Low | `runtime/runtime-uring.c` (`nish_uring_send`, `nish_uring_shutdown`), `runtime/runtime-net.c` (`nr_send`) | `NR_AREA` bounds a slot's unsent bytes, not its memory. A record holds its bytes until the kernel has taken all of them, so the head of a short send keeps the bytes already sent, and an append never passes a shutdown, so the last record before each shutdown in the queue can be a pool buffer with room left. Found in review: `nish_uring_shutdown` queued a record for every call, so a program alternating a one-byte write with a repeated `netShutdown` of the same side held a 16 KiB pool buffer for each byte, past any bound `NR_AREA` gives. | **Fixed before landing**: the slot's state keeps the sides a shutdown has queued (`ST_SHUT`), and a shutdown of a side already queued answers 0 and queues nothing, so a slot holds at most two shutdowns and the bytes between them at most three partly filled buffers. Before: "1000 pool buffers held", failing with "writes between repeated shutdowns each held a pool buffer"; after: "uring: runtime-uring.c shutpool: 1,000 one-byte writes, each behind a repeated shutdown, hold at most five pool buffers (NURING-43)" reads 5 held, the three byte records and, since NURING-51, the two shutdowns' own pool buffers, and the peer still reads every byte and then the end of the stream. What bounds the rest of a slot's memory is NURING-44, open. |
| NURING-44 | Low | `runtime/runtime-uring.c` (`nish_uring_send`, `ur_record`), `runtime/runtime-net.c` (`nr_send`) | Split from NURING-43: a slot's memory past its unsent bytes is bounded only by reading the code. Since NURING-51 every record is a 16 KiB pool buffer carrying up to 16,336 bytes, and a write fills the slot's last buffer before it chains new ones, so every buffer is full but the head (which keeps the bytes already sent until the kernel has taken the rest), one the kernel holds that a later write could not join, and the last before each of the at most two shutdowns and at the queue's end. With at most `NR_AREA` (256 KiB) unsent, that is at most 16 full buffers, five partly filled and the two shutdowns': 23 buffers, 368 KiB. | **Open, untested.** No check measures a slot's memory under a peer that reads slowly; "net_ring: writes to a peer that does not read answer -11 within the kernel's buffers and the send area, and every byte arrives" bounds the bytes, not the buffers. The head's sent bytes are now at most one buffer, not up to `NR_AREA` as with the exact records before NURING-51. |
| NURING-45 | Low | `runtime/runtime-uring.c` (`nish_uring_wait_direct`, `nish_uring_poll_events`, `ur_complete`'s `UR_POLL`), `runtime/runtime-net.c` (`nr_direct`, `nr_poll_wait`) | A loop that holds only ring slots, and at most `signalFd()`, now sleeps in `io_uring_enter` on its ring with an `IORING_ENTER_EXT_ARG` timeout rather than in `epoll_wait` on the ring's eventfd, and watches `signalFd()` by a one-shot `IORING_OP_POLL_ADD` in that ring. That is a new operation in the ring, on a plain descriptor number, not a slot of the registered table, and a new path on which the NURING-8 bound and the signal's wake must still hold. | **Decided.** The poll goes only into an unrestricted ring: `nish_uring_wait_direct` answers `-EOPNOTSUPP` for a watched descriptor on a restricted (`--sandbox`) ring, and the loop sleeps on epoll as before, so the restriction's seven operations are not widened and the seccomp filter sees no new call; were the check gone, the kernel would refuse `POLL_ADD` there with `-EACCES`, which latches `poll_broken`. Only `nr_direct`'s loop watches anything, and only `nish_signal_fd_made()`, the signal pipe's read end, which the runtime never closes and which, once the program closes it with `netClose` or `fileClose`, no loop waits directly on again with it watched (NURING-48, NURING-49); the poll holds a reference to that file until it answers or the ring is destroyed, and a set watches one descriptor at a time (a second answers `-EOPNOTSUPP`). It is armed once and re-armed only after its events are taken, so at most one poll is in the kernel. Its completion carries `user_data` 6 (`UR_POLL`), which no slot's encoding can equal, since a slot's operation in the low byte is 1 to 5. A completion that fails other than by cancel stops the watch for good (`poll_broken`), and the loop falls back to epoll. The `EXT_ARG` argument and its timespec are on the stack for the one `io_uring_enter`, which copies them in. The sleep is `nish_uring_sleep_ms`'s, so NURING-8's bound holds: "uring: runtime-uring.c direct: …" requires an idle direct wait to sleep at least `UR_SLEEP_MAX_MS` less 1 ms and to fail only past 500 ms, to end early on its minimum and wait the bound out short of it, to answer a watched pipe by `POLL_ADD` and refuse a second descriptor, not to re-arm until the events are taken, and a ring without `EXT_ARG` (before 5.11) to be refused. That `pollWait` and `pollWaitBatch`'s first wait take this path, and never epoll, on a ring-only loop (the batch's second wait sleeps in `poll(2)` and enters no epoll set either) is "net_ring: pollWaitBatch on ring slots answers …, with every epoll wait refused", whose `noepoll.c` makes every epoll wait fail. Read, not tested: the restricted ring's refusal, the `poll_broken` latch, and the clamp of the minimum to the CQ's size; they are listed as untested under "What the batch wait adds" below. |
| NURING-46 | Low | `runtime/runtime-net.c` (`nr_batch`, `nish_poll_wait_batch`) | `pollWaitBatch`'s second wait, once the first event is in, waits on the one ring set for `minEvents` or `maxWaitMs` and reads no epoll set, so an ordinary descriptor in the same loop that becomes ready meanwhile is reported only by the next call, up to `maxWaitMs` late. A peer that sends nothing more holds every batch for its full `maxWaitMs`. | **Decided.** Both delays are bounded by `maxWaitMs`, which the program chooses, and a batch is the program's choice to trade latency for fewer wakes; `pollWait` is unchanged. A loop with two live ring sets takes no second wait (`nr_batch` answers what the first wait took). The signal is not left to the bound on a direct loop: the second wait sleeps in `poll(2)` slices on `signalFd()`, which end the batch as soon as it answers, and the next call reports it. "net_ring: a SIGTERM ends a pollWaitBatch for 256 events long before its maxWaitMs" asks for 256 events with a `maxWaitMs` of 5,000, sends SIGTERM 300 ms in and requires the wait to end within 2,500 ms. Where the loop does not wait directly, the signal waits up to `maxWaitMs`, as any other descriptor does: a loop that also holds other descriptors, and a `signalFd()` the program has closed (NURING-48, NURING-49). A listener grown past its first ring still watches the signal in the second wait, since `nr_direct` counts ring sets, not rings. The second wait reaps the ring only after each slice, so a window with a large `maxWaitMs` holds accepts and send completions for up to `maxWaitMs / 8` (625 ms at 5,000); `HttpHandler` caps `maxWaitMs` at 1,000, which bounds that at 125 ms. |
| NURING-47 | Low | `runtime/runtime-net.c` (`nr_batch`) | `nr_batch` took its second wait whenever one ring set was live, whatever the loop held, so a batch on a loop of ordinary descriptors, while a ring listener lived in another loop or in none, answered its first event only after `maxWaitMs` of sleeping on a ring that could add nothing to it; `runtime/nish.d.ts` promises such a loop answers as `pollWait` does. | **Fixed before landing**: `nr_batch` answers what the first wait took unless the loop is one a virtual source has joined (`nr_loops`, or any once `nr_loops_spilled` is set). Before: "net_ring: pollWaitBatch on a loop no ring source joined answers as pollWait does, not at its maxWaitMs" failed, the `apart` mode answering its one datagram after 3,000 ms (`a wait for 8 on a loop with no ring source answered 1 after 3000 ms`). After: it passes, the datagram answered in under 1,500 ms. |
| NURING-48 | Low | `runtime/runtime-net.c` (`nr_direct`, `nish_net_close`) | After `netClose(signalFd())`, `nish_signal_fd_made()` still names the closed number and the ring's `POLL_ADD` stays armed on the old pipe, which it holds a reference to. A socket that took the number and joined the loop for reading was taken for the watch, and since the poll was armed on that number it was not re-armed: the loop slept on its ring and never reported the socket. | **Fixed before landing**: `nish_net_close` notes the close of the signal descriptor (`nish_signal_fd_closing`, which sets `nish_signal_closed` in `runtime-host.c`), and from then on `nr_direct` sends any loop with an ordinary descriptor to epoll; a loop of ring slots alone still waits directly. Before: "net_ring: a socket on a closed signalFd()'s number is reported, not taken for the ring's watch" failed, the `reuse` mode's `pollWait` answering 0 at its 2,000 ms timeout with a datagram due (`a wait on the reused number answered 0 after 2000 ms`). After: it passes, the datagram reported in under 1,000 ms. The fix as first written saw only `netClose`, so a close by `fileClose` still reached the bug (NURING-49). |
| NURING-49 | Low | `runtime/runtime-host.c` (`nish_signal_fd_made`, `nish_signal_fd_closing`), `runtime/runtime-os.c` (`nish_file_close`), `runtime/runtime-net.c` (`nish_net_close`, `nr_direct`) | NURING-48's fix noted only `netClose`. `fileClose(signalFd())` closed the pipe unseen, so a socket that took the number was taken for the watch exactly as before, and the record claimed no other route existed. | **Fixed before landing**: the close is recorded in `runtime-host.c` (`nish_signal_fd_closing`), which both `nish_net_close` and `nish_file_close` call before they close, and `nish_signal_fd_made` answers -1 from then on, so no loop watches the number again. An audit of the native runtime's 56 `close(` calls finds these two the only exported routes that close a number the program supplies; the rest close descriptors the runtime made (`nishshm_close` and `nish_uring_close` take a handle or a slot, not a number). Before: "net_ring: a socket on a signalFd() number fileClose freed is reported, not taken for the ring's watch" failed, the `reusefile` mode's `pollWait` answering 0 at its timeout with a datagram due (`a wait on the reused number answered 0 after 1999 ms`). After: it passes. |
| NURING-50 | Low | `runtime/runtime-uring.c` (`nish_uring_wait_direct`) | A reap of the set before the wait (any pump that drains its completions) could take the `signalFd()` poll's completion, leaving its events in `poll_revents` untaken. The next direct wait saw the poll armed-and-answered, did not re-arm it, and slept a whole enter (up to `UR_SLEEP_MAX_MS`) on a signal already in. | **Fixed before landing**: `nish_uring_wait_direct` answers 0 at once, without an enter, while a watched poll's events are untaken, and the loop reports them. Before: "uring: runtime-uring.c direct: a direct wait on the ring (IORING_ENTER_EXT_ARG) sleeps its bound idle, ends early on its minimum, waits the bound out short of it, answers a watched pipe by POLL_ADD, does not sleep while that answer is untaken, and a ring without EXT_ARG is refused it (NURING-45)" failed (`a direct wait entered the kernel to sleep with its poll already answered`) with the early answer removed. After: it passes. |
| NURING-51 | Low | `runtime/runtime-uring.c` (`nish_uring_send`, `nish_uring_shutdown`, `ur_record`) | A write that outgrew the slot's last pool buffer took one exact `malloc` of its whole length, and every shutdown a `calloc` of its own, so a server answering 64 KiB responses allocated and freed a record for each, and the pool (NURING-41) did nothing for them. | **Fixed**: a write fills the last buffer's room and goes on in pool buffers chained behind it, every one taken before any byte is copied, so a failed take queues nothing and answers `-ENOMEM`; a shutdown's record is a pool buffer. Each chained buffer is its own SEND: a head and a 64 KiB body leave as five, a head+body that fits one buffer still as one. Before: "64 KiB responses: sends per response 1.00, 100 records allocated after the warm-up", failing with "a steady 64 KiB response allocated a record after the warm-up", and with only the chain in place "a write and a shutdown: 1 held", failing with "a shutdown did not take its record from the pool". After: "uring: runtime-uring.c bigsend: steady 64 KiB responses leave as one SEND per chained pool buffer and allocate nothing after a warm-up, a shutdown's included (NURING-51)" reads "sends per response 5.00 (at least 5), 0 allocations after the warm-up, 0 held" and "a write and a shutdown: 2 held, 0 allocations". The Before figures came from the test's earlier hook, which counted only the records' own `malloc`. The test now defines `malloc`, `calloc` and `realloc` itself, forwarding to glibc's, and counts every call the process makes after the warm-up, so any allocation on the send path fails it: with a `free(malloc(32))` added to `nish_uring_send`, at `-O0` and `-O2`, it printed "200 allocations after the warm-up" and failed with "a steady 64 KiB response allocated after the warm-up". It also fails when a response takes fewer SENDs than the pool buffers it fills ("a 64 KiB response took fewer SENDs than the pool buffers it fills"). |

## Properties verified

Each property below is pinned by a test that fails if it stops holding. The
tests are the modes of `tests/runtime/uring-test.c`, run by `tests/run.js`'s
`uring` section, each as one check: "uring: tests/runtime/uring-test.c
compiles with runtime-uring.c and runtime-net.c under -Werror", then "uring: runtime-uring.c
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
- **No second hangup.** "uring: runtime-uring.c hupheld" (NURING-27): a
  client writes five bytes and resets; once the parent has the data and the
  `-104` hangup, it holds the slot and lets it go, and 500 ms of waits must
  then report no event.
- **Memory short at accept.** "uring: runtime-uring.c nomem" (NURING-28):
  two accept completions are turned into `-ENOMEM`; each pauses accepting
  and is reported once, the second with twice the first's back-off, a paused
  set asks for no wait at once, and the next client is accepted.
- **Buffers run out.** "uring: runtime-uring.c nobufs: a recv that runs out
  of provided buffers is re-armed, not closed": a peer that fills every
  buffer delays the others' receives and closes nothing.
- **Sends.** "uring: runtime-uring.c short: an 8 MiB send the kernel takes
  short arrives whole and in order", and NURING-1's "reset" check.
- **One SEND a pass.** "uring: runtime-uring.c coalesce: a head+body
  response and three back-to-back writes each leave as one SEND
  (NURING-40)": over 200 head+body responses the ring's SEND counter moves
  by one a response, and three writes queued in one pass leave as one.
  "uring: runtime-uring.c inflight: writes behind a SEND in flight join one
  record and arrive in order across short sends (NURING-40)": 16 MB in
  1,000-byte writes to a client that does not read yet, so a SEND stays in
  the kernel, arrive whole and in order once it reads. "uring:
  runtime-uring.c netwrite: netWrite2 through runtime-net.c's ring slots,
  and three back-to-back netWrites, each leave as one SEND (NURING-40)".
- **The send pool.** "uring: runtime-uring.c pool: a burst leaves no buffer
  on an idle slot and exactly UR_SENDPOOL_MAX cached, and steady responses
  allocate none (NURING-41)". "uring: runtime-uring.c shutpool: 1,000
  one-byte writes, each behind a repeated shutdown, hold at most five pool
  buffers (NURING-43)". "uring: runtime-uring.c bigsend: steady 64 KiB
  responses leave as one SEND per chained pool buffer and allocate nothing
  after a warm-up, a shutdown's included (NURING-51)".
- **Stale handles.** Every mode that closes a slot checks, once, that a send
  and a second close on the closed slot answer `-EBADF`. No check reuses a
  slot G times; past that a stale handle aliases (NURING-29).
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
  `.text` budget, "runtime-uring.c: .text* at -Oz fits the 7424 byte
  budget".

### What S2 adds

S2's tests are Nish programs in `tests/link/net_ring_*`, run by `tests/run.js`'s
`net_ring` section under `client.mjs`, each judged by its own exit status and
its last line. A program that finds rings refused exits 2, which the section
counts as a skip, never a pass.

- **Past the descriptor limit, from a program.** "net_ring: a ring listener
  serves 3,000 connections under a limit of 1,024 with fewer than 64
  descriptors": `echo.ts` echoes five bytes on each of 3,000 connections
  through `pollWait`, `netRead` and `netWrite`, counts `/proc/self/fd` with
  all of them open, and requires every handle to be at 2^20 or above, where
  no descriptor is.
- **A full set and a stale handle.** "net_ring: a full set answers -23, a
  closed handle -9, and the freed slot is taken again" (NURING-6).
- **Sends are bounded.** "net_ring: writes to a peer that does not read
  answer -11 within the kernel's buffers and the send area, and every byte
  arrives" (NURING-2): the first -11 must come before 32 MiB of the 64 MiB
  the program writes, and the peer must then receive exactly 64 MiB.
- **Receives are bounded.** "net_ring: a peer the program does not read
  stalls within the kernel's buffers, and every byte arrives once it reads"
  (NURING-9): the peer must stall before 32 MiB of its 64 MiB, and the
  program must then read all 64 MiB, so the held receive went again.
- **An empty first range answers -11 too.** In the same program, at the
  first -11, `netWrite2` with an empty first range must answer -11, not 0
  (NURING-21).
- **A close after the peer's FIN.** "net_ring: a close after the peer's FIN
  still sends every queued byte, and a closed loop lets its slots go":
  `halfclose.ts` closes a slot with 256 KiB queued after the client's end,
  and the client must receive every byte; a slot in a loop the program
  closed must join a new loop.
- **A descriptor beside ready slots.** "net_ring: a descriptor is reported
  beside more ready slots than one wait holds" (NURING-18): `starve.ts` holds
  80 always-writable slots beside one descriptor, and waits with room for 64
  and for one must each report it.
- **A reset slot refuses writes.** "net_ring: a slot whose peer reset it
  answers netWrite with an errno" (NURING-23): `reset.ts` reads until
  `netRead` answers the client's reset, and `netWrite` must then answer a
  negative errno.
- **A transient ring failure is not kept, nor fatal.** "net_ring: a probe
  or first set that fails for want of a descriptor is not kept, the next ring
  listen opens rings, and a later set that fails for one falls back"
  (NURING-20, NURING-22, NURING-26): `transient.ts`, under `ulimit -n 32`,
  fills the descriptor table so the probe answers -24, and then so the probe
  passes and the first set's open answers -24; `netRingState()` must stay 0
  after each, once descriptors are free the next ring listen must open rings
  and answer 1, and with the table full again a later ring listen must
  succeed on descriptors with the state still 1.
- **An idle slot holds no receive queue.** "net_ring: an idle keep-alive
  slot holds no receive queue: under 1,536 bytes a connection at 3,000
  (NURING-38)": `idle.ts`, under a limit of 4,096 so the 3,000 slots share
  one ring, reads each request to -11 and echoes it while the client keeps
  every connection open, and its anonymous resident set, read from
  `/proc/self/status` (`RssAnon`, in kB, so no page size is assumed) before
  the first accept and after the last echo, must have grown by under 1,536
  bytes a connection.
- **Refused io_uring, from a program.** "net_ring: with io_uring_setup
  refused, a ring listener serves descriptors and netRingState() is -1":
  under a seccomp filter that answers io_uring_setup with EPERM, the same
  listener accepts descriptors, and `netRingState()` says why.
- **The calls a ring handle takes.** `tests/cases/net_ring_calls` pins the IR
  of `NET_LISTEN_RING` and `netRingState()`, and `reject_net_ring_arity` and
  `reject_net_ring_wasm` the programs the checker refuses.

### What S3 adds

S3's tests are in `tests/run.js`'s `sandbox` section, which links
`tests/link/sandbox_fixtures/probe.c` beside Nish programs built with
`--sandbox` and the runtime compiled with `-DNISH_URING_TEST_HOOKS`; each
check that runs a ring runs under `--sandbox` and `--sandbox=best-effort`,
and they are skipped, by name, on a kernel that refuses `io_uring_setup`
unconfined. The filter's rows are `sandbox.md`'s; these are the rings'.

- **The restriction.** "sandbox: a premade ring refuses IORING_OP_SOCKET with
  EACCES", and the same for `CONNECT`, `OPENAT`, `READ`, `WRITE`, `SENDMSG`,
  `MSG_RING` and `URING_CMD`; "sandbox: a premade ring refuses IOSQE_IO_LINK
  with EACCES", and the same for `IO_DRAIN`, `IO_HARDLINK` and `ASYNC`. The
  controls: "sandbox: a premade ring completes a NOP", and "sandbox: a
  premade ring takes ACCEPT past its restriction", and the same for `RECV`,
  `SEND`, `CLOSE`, `ASYNC_CANCEL`, `SHUTDOWN` (NURING-39) and `RECV` with
  each allowed flag.
- **The layer on a restricted ring.** "sandbox: a sandboxed NET_LISTEN_RING
  listener serves a loopback connection through a premade ring".
- **The pool.** "sandbox: a main that reaches NET_LISTEN_RING holds 1 premade
  ring", "sandbox: `nish.netRings` 3 premakes 3 rings", "sandbox: without
  --sandbox a ring program premakes no ring (the control)", and in the
  `net_ring` section "net_ring: under --sandbox a full set of premade rings
  answers -23 and makes no ring past them" (NURING-31).
- **The floor.** "sandbox: on a kernel that refuses DEFER_TASKRUN no ring is
  premade and the probe answers EINVAL (NURING-33)".

### What the batch wait adds

The direct wait's tests are the `direct` mode of `tests/runtime/uring-test.c`
and the `net_ring_batch` link test, which `tests/run.js`'s `net_ring` section
runs under `tests/link/net_ring_batch/noepoll.c`, a wrapper whose seccomp
filter makes every epoll wait answer `EPERM`; the program's exit status is the
verdict, and a kernel that refuses rings, takes no filter or has no
`IORING_FEAT_EXT_ARG` is a counted skip.

- **The direct wait keeps NURING-8's bound and its minimum.** "uring:
  runtime-uring.c direct: a direct wait on the ring (IORING_ENTER_EXT_ARG)
  sleeps its bound idle, ends early on its minimum, waits the bound out short
  of it, answers a watched pipe by POLL_ADD, does not sleep while that
  answer is untaken, and a ring without EXT_ARG is refused it (NURING-45)".
  Its "does not sleep" part (NURING-50) lets a reap take the poll's answer
  on a readable pipe, leaves its events untaken, and requires the next direct
  wait, for 1,000 ms on an otherwise idle set, to answer 0 with no enter
  counted.
- **A ring-only loop never reaches epoll, and a batch is bounded by
  `ready`.** "net_ring: pollWaitBatch on ring slots answers a full batch at
  once, a short one at maxWaitMs, an idle one at its timeout and caps a batch
  at ready's room, with every epoll wait refused". `nish_poll_wait_batch`
  writes at most `min(ready.length / 2, 64)` pairs, whatever `minEvents` asks;
  the check requires a `ready` of 8 asked for 16 to answer 4 (`batch: a ready
  of 8 capped a wait for 16 at 4`). Before/after: with
  `nish_poll_wait_batch`'s `max` set to 64 whatever `ready` holds, the check
  fails (the program exits 1 after its third line, `batch: an idle wait
  answered 0 at its timeout`); restored, it passes.
- **A signal ends a batch on a direct loop** (NURING-46). "net_ring: a
  SIGTERM ends a pollWaitBatch for 256 events long before its maxWaitMs".
  Before/after: with `nr_batch`'s break on the `signalFd()` poll removed, the
  check fails (`signal: SIGTERM ended a wait for 256 after 10010 ms, in 2
  waits`); restored, it passes.
- **A batch window pumps at most eight times** (NURING-46). "net_ring: a
  pollWaitBatch window that bytes trickle into waits and pumps at most 8
  times and enters the ring fewer than 50 times" reads the stats line's
  `windows`, `window_waits` and `enters` around a window that a child's
  bytes trickle into. Before/after: on the window that slept on the ring
  for the rest of `minEvents` the check fails, 16 waits and 62 enters in
  each of 10 runs; on the slices it passes, 4 waits and 39 enters in each
  of 10 runs.
- **A batch on a loop with no ring source is a `pollWait`** (NURING-47).
  "net_ring: pollWaitBatch on a loop no ring source joined answers as
  pollWait does, not at its maxWaitMs" runs `batch.ts apart`, a wait for 8
  with a `maxWaitMs` of 3,000 on a loop holding one UDP socket with a
  datagram due, while a ring listener is live outside it.
- **A closed signal descriptor's number is not the watch** (NURING-48).
  "net_ring: a socket on a closed signalFd()'s number is reported, not taken
  for the ring's watch" runs `batch.ts reuse`, and "net_ring: a socket on a
  signalFd() number fileClose freed is reported, not taken for the ring's
  watch" runs `batch.ts reusefile` (NURING-49); in each, exit 5, a socket
  that took another number, is a counted skip.
- **The calls.** `tests/cases/net_poll_batch` pins the IR of
  `pollWaitBatch`, and `reject_net_poll_batch_arity`, `_readonly`, `_wasm`
  and `_wasi` the programs the checker refuses.

Read, not tested: `nish_uring_wait_direct`'s refusal of a watched descriptor
on a restricted ring (no `--sandbox` program has a direct loop that watches
one, since the refusal is what sends it to epoll, and the `sandbox` section
has no check that would see the poll), the `poll_broken` latch after a poll
that fails, and the clamp of a wait's minimum to the CQ's size, which a batch,
asking for at most 64 at a time, reaches only on a set whose CQ holds fewer
(the default is 8,192).

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
(`7644b1a1c9a7`) landed in 6.6. S2 makes the layer reachable from a program
through the same operations, so the list stands for it; a stage that reaches
a new operation looks again for newer flaws in the kernel CNA's record
(`git.kernel.org/pub/scm/linux/security/vulns.git`, `cve/published/`,
searched for `io_uring/`) and NVD. Since 2024 the CNA assigns a CVE to most
io_uring fixes, so the full record is far longer than this; these are the
memory-safety flaws in code S1 drives.

**What the table covers, and what it does not.** The rows above are the
records this review classified; each was read on 2026-11-16 in `cvelistV5`
(a clone at commit `f63b785f`), and its fix commit placed on a mainline tag
through `github.com/torvalds/linux`. The fixes for CVE-2021-3491,
CVE-2022-29582, CVE-2022-1116, CVE-2022-3910, CVE-2023-21400 and
CVE-2023-0240 also come from their CNAs and the Ubuntu, openEuler and Red Hat
patch threads; where a point release is inferred from an affected range
rather than read, the row says so. NVD, `git.kernel.org` and the kernel
CNA's `vulns.git` were not reachable from the review and were not consulted.
The list is not complete. The same `cvelistV5` clone holds 103 published
Linux-CNA records from 2021 to 2026 whose `programFiles` name `io_uring/`,
`fs/io_uring.c` or `fs/io-wq` (30 published in 2024, 37 in 2025 and 37 so far
in 2026), 145 Linux-CNA records that name io_uring anywhere, and about 35
from other CNAs (MITRE, Google, Canonical, Red Hat, Android), most from 2021
to 2023. **Unclassified**: every one of those records not named in this
section; they were counted, not read one by one, so whether one reaches the
layer's operations is unknown. A stage that reaches a new operation, flag or
registration reads them against it. They are not listed here by ID:
the count came from a clone that S3's review and its follow-up (issue
#1690) could not reach again, and an ID list with no verdict beside it
would read as a classification it is not; a stage that reads them adds each
as a row with its verdict.

**The floor the probe sets.** `ur_probe_once` accepts a kernel only if setup
takes `SINGLE_ISSUER` and `DEFER_TASKRUN` (6.0 and 6.1), sparse file
registration and `PBUF_RING` register (5.19), and the probe lists the five
operations. In practice that is 6.1 or later, or a vendor kernel that
backported these, so a flaw fixed in mainline before 6.1 is reachable only
on a vendor kernel that took the feature without the fix.

| CVE | What, in code S1 reaches | Fixed in | S1 |
| --- | --- | --- | --- |
| CVE-2023-0469 | a reference underflow installing a fixed file (`io_install_fixed_file`, an extra `fput`; Red Hat records it as a use after free): `ACCEPT` and `CLOSE` on direct descriptors | 6.1 (fix `9d94c04c0db0`, first in 6.1-rc7; introduced by `61c1b44a21d7` in 5.19, so 5.19 and 6.0 are affected, and no upstream stable backport to either was found) | reached by S1's operations; fixed before 6.1 was released, so below the floor |
| CVE-2023-1872 | `io_file_get_fixed` without the ring lock in io-wq: a use after free on fixed files | 5.18 | below the floor |
| CVE-2023-3389 | cancelling a poll request that has a linked timeout races the timeout: a use after free in an hrtimer | 6.4 (5.13 to 6.3 affected; 5.10.162 to 5.10.184 too) | not reached: above the floor, but it needs a linked timeout (`IOSQE_IO_LINK` with `LINK_TIMEOUT`), and the layer links no requests and submits no timeout |
| CVE-2022-2602 | registered files and the unix socket garbage collector: a use after free | 6.1 | not reached: it needs an io_uring descriptor passed over a unix socket, and a TCP peer cannot pass one; since CVE-2023-52654's fix (`705318a99a13`, 6.7; 6.6.7, 6.1.68, 5.15.143, 5.10.204, 5.4.264) `sendmsg` refuses one with `EINVAL` |
| CVE-2024-0582 | `PBUF_RING` with kernel-allocated memory (`IOU_PBUF_RING_MMAP`), unregistered while mapped: a use after free | 6.7 (6.4 to 6.6 affected) | not reached: the layer maps the buffer ring's memory itself and never passes the flag |
| CVE-2023-6560 | `IORING_SETUP_NO_MMAP`'s ring mapping: out of bounds | 6.7 | not reached: the layer maps its rings |
| CVE-2023-2598 | registered fixed buffers (`REGISTER_BUFFERS`): out of bounds | 6.4 | not reached: no fixed buffers |
| CVE-2023-46862 | `SQPOLL` and the fdinfo reader: a null dereference | 6.6 | not reached: no `SQPOLL` |
| CVE-2021-41073 | classic provided buffers (`IOSQE_BUFFER_SELECT`) on a read: type confusion | 5.15 | not reached: receives only, from a buffer ring |
| CVE-2021-3491 | `PROVIDE_BUFFERS` lengths past `MAX_RW_COUNT`: a heap overflow | 5.13 (`d1f82808877b`; 5.12.4, 5.11.21, 5.10.37) | not reached: below the floor, and the layer never submits `PROVIDE_BUFFERS` (its buffer ring is registered with `PBUF_RING`) |
| CVE-2022-29582 | a timeout racing its completion (`TIMEOUT`, `LINK_TIMEOUT`): a use after free | 5.18 (`e677edbcabee`; 5.17.3) | not reached: below the floor, and the layer submits no timeout |
| CVE-2022-1116 | 5.4 only: `req->fs` taken on async offload and never put, so `fs->users` overflows | 5.4.189 (`1a623d361ffe`, a 5.4-only patch) | not reached: the code exists only in 5.4, far below the floor |
| CVE-2022-3910 | `MSG_RING` on a fixed file puts the file wrongly | 6.0 (`fc7222c3a9f5`, first in 6.0-rc6; 5.18 to 5.19.10 affected) | not reached: below the floor, and the layer never submits `MSG_RING` |
| CVE-2023-21400 | `IOPOLL` rings: deferred work run without the lock, a double free | 5.18 (by a larger rework, no single commit); stable fixes `810e401b34c4` (5.10.188) and `fb348857e7b6` (5.15, point release not confirmed) | not reached: the layer never sets `IORING_SETUP_IOPOLL`, and the code is in 5.10 and 5.15 only |
| CVE-2023-0240 | 5.10 only: the `io_identity` reference count in `io_prep_async_work`: a use after free | 5.10.162 (`788d0824269b`; the CNA marks 5.10 to 5.10.161 affected; no mainline fix was confirmed) | not reached: the code exists only in 5.10, below the floor |

The rows marked "below the floor" are reachable only on a kernel older than
the probe accepts, or a vendor kernel that backported features without
fixes. Nothing here is a flaw in the layer; the decision it informs is which
kernels may run it, and the probe's feature floor is that decision for now.
A deployment that must pin a kernel should take a 6.1-or-later stable
release with the current stable fixes, since the CNA's record keeps adding
fixes to the multishot receive, provided-buffer and fixed-file code.

**S2's second look.** S2, which makes the layer reachable from a program,
looked again on 2026-11-16, by a web search of the CVE aggregators for 2026
io_uring records in the provided-buffer, receive, accept and fixed-file
code; these were not checked against `cvelistV5` as the rows above were. It
found three, none in code the layer reaches: CVE-2026-53191 (a bundle
receive's `BUF_MORE` flag carried across retries in incremental mode),
CVE-2026-99264 (a retried receive leaving buffers it mapped but did not
commit, with `IOU_PBUF_RING_INC`) and CVE-2026-97618 (a receive with
`MSG_TRUNC` advancing the buffer ring past the bytes written; rejected by its
CNA since). The layer's receive is a multishot `RECV` of one buffer at a
time: it sets no `IORING_RECVSEND_BUNDLE`, registers its buffer ring without
`IOU_PBUF_RING_INC` and passes no `msg_flags`. A use after free in
`io_ring_buffers_peek` posted to the io_uring list in July 2026 is in the
bundle path too.

**What S3 adds.** Under `--sandbox` each ring is created with
`IORING_SETUP_R_DISABLED`, given `IORING_REGISTER_RESTRICTIONS` (the five
operations above and `NOP`; the submission flags `FIXED_FILE`,
`BUFFER_SELECT` and `CQE_SKIP_SUCCESS`; no registration after enabling), its
table, buffer ring and eventfd registered, and enabled, all before the
filter loads; the filter then kills `io_uring_setup` and `io_uring_register`.
The setup flags drop `SINGLE_ISSUER` and `DEFER_TASKRUN` and add
`COOP_TASKRUN` (NURING-30), and the probe still sets the floor (NURING-33).
What that changes in the table above, row by row:

- **Still reached**, by the operations a restricted ring allows:
  CVE-2023-0469 and CVE-2023-1872 (fixed files, below the floor), and the
  multishot receive from a buffer ring that S2's second look covers. A
  restriction narrows what a program can submit, not the code these seven
  operations run.
- **Still not reached, now by the restriction too**: CVE-2023-3389
  (`IOSQE_IO_LINK` completes with `-EACCES`, and `LINK_TIMEOUT` is not an
  allowed operation), CVE-2021-41073 (`READ` is refused), CVE-2023-2598
  (`REGISTER_BUFFERS` needs `io_uring_register`, which the filter kills),
  CVE-2023-46862 and CVE-2023-6560 (setup flags, and setup is killed after
  the rings are made), CVE-2024-0582 (the layer's buffer ring is its own
  memory, and no registration can change it once enabled).
- **Not reached, by the peer**: CVE-2022-2602, as before.
- **The six rows read from their CNAs and patch threads**, each below the
  floor already. Not reached, now by the restriction too: CVE-2021-3491
  (`PROVIDE_BUFFERS` is not an allowed operation), CVE-2022-29582 (neither
  `TIMEOUT` nor `LINK_TIMEOUT` is), CVE-2022-3910 (`MSG_RING` is not) and
  CVE-2023-21400 (`IORING_SETUP_IOPOLL` is a setup flag the layer never
  sets, and setup is killed once the rings are made). Not reached, by the
  kernel alone, with no S3 verdict: CVE-2022-1116 and CVE-2023-0240, whose
  code exists only in 5.4 and 5.10; their rows say which code, not which
  operation reaches it, so the restriction's effect on them is not recorded.

The setup-time code (`R_DISABLED`, `REGISTER_RESTRICTIONS`,
`REGISTER_ENABLE_RINGS`) runs before the filter, on the program's own
arguments, so a remote peer reaches none of it. Its own record, both
published by the Linux CNA and read in `cvelistV5` on 2026-11-16:
CVE-2026-99096 (a ring created disabled while its task had task-level
restrictions, added by `ed82f35b926b`, took any registration before it was
enabled; 7.0 affected, fixed in 7.2.11 and 7.3; the record says per-ring
restrictions on a disabled ring work as before) and CVE-2026-80713 (`exec`
freed a task's task-level restrictions; 7.0 affected, fixed in 7.1.8 and
7.2). Neither is reached: the layer uses per-ring
restrictions, never the task-level ones, the filter kills
`io_uring_register`, and without `process.spawn` it kills `execve`.

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
running `destroy`. Under `--sandbox` a ring has no `DEFER_TASKRUN`
(NURING-30): there `COOP_TASKRUN` queues the same retries as task work on
the thread that submitted them, which is still the owning thread, but runs
them at that thread's next return from the kernel rather than only inside
`io_uring_enter`; the premise holds because `destroy` runs on that thread,
and is the layer's to keep, since no `SINGLE_ISSUER` checks it. This rests
on one assumption about the kernel: that
closing a ring cancels the task work still queued on it rather than running
it, from a fallback worker, after `close` returns. The code cannot show that
window closed on every kernel the probe accepts. S2 makes `destroy`
reachable from a program, as `netClose` of a ring listener
(`nr_close_listener`), and keeps the assumption's premise: the set has one
owning thread (the design's D3), the one that made it, and `nr_close_listener`
runs on it. It takes every slot out of the program's poll loops first, so no
later `pollWait` reaches a freed slot, and a handle of the closed set answers
-9, because the set's record stays, marked dead.

**Options.** `nish_uring_open` refuses a `buf_count` that is not a power of
two or is past 32,768, a `buf_size` past 1 MiB, a `rings_max` past 4,096
and `slots` past 2^20, with `-EINVAL`, before it maps anything.

**A wait interrupted by task work.** On a `DEFER_TASKRUN` ring, the kernel's
task work can end an `epoll_wait` on the program's poll loop with `EINTR` when
no signal was delivered. `nr_poll_wait` takes `EINTR` as a wake, takes in the
rings' events and waits again for what is left of its timeout, so a program's
`pollWait` does not answer -4 for an event of the layer's own. Found by
`echo.ts` while S2 was written.

**What the send pool costs a ring process (issue #2260).** The
handler-ring bench measured it with `BENCH_URING_STATS=1 bash
bench/handler-ring/run.sh --nodb --server-cpus 0 --compiler build/nish-test
--base-compiler <base>`, at `--conns 18000` and at `--conns 96000 --think 4
--warmup 4`. The runtime was this branch's at ebbeca4e. The base build was
b2c55694, the commit before the send pool. Over three rounds, the median PSS
of a `ring` server was 11.3 MB against 10.6 MB at 18,000 connections, and
34.1 MB against 31.7 MB at 96,000. For `h1-ring` it was 10.1 against 9.5,
and 32.9 against 30.6. The stats line printed mid-load read `pool_held=0`,
with `pool_cached` at 64 and at 187 to 192. `pool_new` read 504 to 1,746
over the warm-up and the first half of the run: the buffers in use at a
pass's peak are more than the cache keeps, and the rest go back to malloc.
At fb400a0d, one round at 96,000 connections saved each server's
`/proc/PID/smaps` at the same moment. Total PSS was 34,214 kB against
31,822 kB, a rise of 2,392 kB. Of that, 1,728 kB was the malloc heap
(`[heap]`, 5,344 kB against 3,616 kB), where the pool's 16 KiB buffers
live. A further 652 kB was in anonymous mappings outside the heap
(26,048 kB against 25,396 kB). The four mappings of 3,332 kB each grew by
128 KiB, 492 kB of PSS among them. That is the size of one ring's `mlist` at
32,768 slots, 4 bytes a slot, the one per-slot array the send pool added.
The mapped files differed by 8 kB and the stacks by 4 kB. At c2a60fe4, one
round at 18,000 connections did the same: 11,556 kB against 10,660 kB, a
rise of 896 kB. The heap was 772 kB of it (2,992 kB against 2,220 kB), the
other anonymous mappings 68 kB (6,560 kB against 6,492 kB, laid out in 7
mappings against 9, so no per-mapping pairing), the mapped files 48 kB and
the stacks 8 kB.

The heap's resident rise is less than the cached buffers' size; its
mapped size is not. At 96,000 connections the stats line read `pool_cached=192`, 3,072 KiB
of buffers; the heap's mapped size grew by 3,732 kB (7,868 kB against
4,136 kB), room for all of them, but its resident pages by 1,728 kB. At
18,000 it read `pool_cached=64`, 1,024 KiB; the mapped size grew by
1,356 kB (4,052 kB against 2,696 kB) and the resident pages by 772 kB. PSS
counts a page only once it is written, and a pool buffer is written only as
far as the bytes put in it: under `--nodb` this bench's response is a head and a
13-byte body (`bench/handler-ring/server.ts`, `lookup`), so most of each
16 KiB buffer's four pages are never touched. That a cached
buffer's tail stays unbacked is read from the code (`nish_uring_send`
copies only the write's bytes, and nothing clears a buffer); the smaps show
only the totals, not which pages of the heap are whose.

This is decided, as NURING-41's cap is: about 25 bytes a connection at 96,000,
for one SEND a response (NURING-40) and no allocation on a steady
connection (NURING-41).
