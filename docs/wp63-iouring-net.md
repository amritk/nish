# WP63: io_uring direct descriptors for `nish:net` — measured and designed

**Status: measured and designed; nothing in `runtime/` or `src/` is built.**
Stage A, the go/no-go measurement, is `bench/fd-limit/` and its figures are
§3. Stage B is this note. [LANGUAGE.md](LANGUAGE.md) stays normative. The
anchors are at `4071dda4`; kernel anchors are at Linux v6.18 unless a version
is named.

**Verdict: go.** Under a hard `RLIMIT_NOFILE` of 20,000, one process held
300,000 established sockets in 15 rings, and its own descriptor table held 35
entries. At that C it spent 15.10 µs of CPU per request against 24.77 µs for
the epoll design: 39.0% less, against a 2.8% noise band, and no round saved
less than 31.9%. At 96,000 connections, where both designs run as the entry
does with five epoll processes, the saving is 20.0% against a 1.4% band. The
implementation stages are §10, and S1 is next.

## 1. Why this is reopened

A native Nish server holds one file descriptor per connection, and a process
may hold no more descriptors than its hard `RLIMIT_NOFILE`. Since #1548 the
first descriptor-making `nish:net` call raises the soft limit to the hard one
(`docs/guide/using-nish/networking.md`, "How many connections: the descriptor
limit"), so the hard limit is now the ceiling. Past it is the operator's:
`ulimit -Hn`, systemd's `LimitNOFILE=`, or `CAP_SYS_RESOURCE`.

The benchmark box runs the server under systemd with `LimitNOFILE=65535`
(soft = hard) and no `CAP_SYS_RESOURCE`. A 300k-user score needs about 300k
keep-alive sockets. One process can hold 65,535 at most, so the entry runs
five `SO_REUSEPORT` epoll processes under `nish/net/prefork`
([WP42](wp42-multicore-server.md)). Measured at 18k connections, those five
cost 22–26% more CPU per request than one process does: 43.4 against 34.5 µs
with writes, 29.0 against 23.8 µs read-only. Each process also keeps its own
SQLite page cache.

On Linux the only way an unprivileged process can hold sockets past a hard
`RLIMIT_NOFILE` is io_uring's registered file table. A connection accepted
straight into a slot of that table (a *direct descriptor*) never enters the
process's descriptor table. The top entry, rust-iouring-kensac at 310k users,
runs up to 16 rings of up to 65,535 slots each.

io_uring was dropped from #1543 on syscall cost alone. Entry and exit cost
106 ns, about 4% of a keep-alive request's 5 µs of system time
([bench/README.md, "Syscall cost"](../bench/README.md#syscall-cost);
[WP39 §6](wp39-http-server.md#6-not-in-the-list-on-purpose)). That still
holds, and this note does not argue against it. The descriptor limit is a
separate argument, and nobody had measured it. #1092 records what the
syscall-cost run left unmeasured on the reported box; this note does not
settle that either (§3.5).

## 2. What the kernel gives, and when

Every version below is the first tag whose `include/uapi/linux/io_uring.h`
defines the name, checked against the kernel source at v5.15, v5.16, v5.17,
v5.18, v5.19, v6.0, v6.1 and v6.18. The behaviour notes cite v6.18's
`io_uring/` sources.

| Feature | Name | First kernel |
| --- | --- | --- |
| Ring restrictions, a ring created disabled | `IORING_REGISTER_RESTRICTIONS`, `IORING_SETUP_R_DISABLED` | 5.10 (present at 5.15) |
| Registering files with flags | `IORING_REGISTER_FILES2` | 5.13 (present at 5.15) |
| Skipping a success CQE | `IOSQE_CQE_SKIP_SUCCESS`, `IORING_FEAT_CQE_SKIP` | 5.17 |
| A sparse file table | `IORING_RSRC_REGISTER_SPARSE` | 5.19 |
| Accept into a slot the kernel picks | `IORING_FILE_INDEX_ALLOC` | 5.19 |
| Multishot accept | `IORING_ACCEPT_MULTISHOT` | 5.19 |
| Provided-buffer rings | `IORING_REGISTER_PBUF_RING` | 5.19 |
| `IORING_SQ_TASKRUN` in the SQ flags | `IORING_SETUP_TASKRUN_FLAG` (with `COOP_TASKRUN`) | 5.19 |
| A socket created by an SQE | `IORING_OP_SOCKET` | 5.19 |
| Multishot recv | `IORING_RECV_MULTISHOT` | 6.0 |
| One submitting task | `IORING_SETUP_SINGLE_ISSUER` | 6.0 |
| The range `FILE_INDEX_ALLOC` picks from | `IORING_REGISTER_FILE_ALLOC_RANGE` | 6.0 |
| Completion work run only when the task asks | `IORING_SETUP_DEFER_TASKRUN` | 6.1 |

The design in §5 needs 6.1. Ubuntu 22.04's HWE kernel, Debian 12 (6.1) and
every current cloud image have it. Below 6.1 the runtime uses epoll, as it
does today.

Four behaviours of the kernel shaped the prototype. A naive version hits
three of them, and the runtime has to handle all four:

1. **A ring's table is capped at `RLIMIT_NOFILE` slots.**
   `io_sqe_files_register` (`io_uring/rsrc.c:554-557`) refuses
   `nr_args > IORING_MAX_FIXED_FILES` (2^20) and
   `nr_args > rlimit(RLIMIT_NOFILE)` with `-EMFILE`. So C connections take
   `ceil(C / limit)` rings. The limit binds the size of each table, not their
   number. A ring costs one descriptor, and two with its eventfd.
2. **A multishot accept overruns a full table and drops the connection.**
   `io_accept` (`io_uring/net.c`) takes the connection off the listener with
   `do_accept` before `io_fixed_fd_install` looks for a slot. When none is
   free, the file is put and the peer sees a reset. A multishot accept loops
   (`goto retry`) while the listener's queue is non-empty, so one burst of
   connections can overrun a ring however early the program cancels.
   Measured: 3 of 78,000 connections lost with four rings armed. The fix is
   single-shot accepts, never more in flight on a ring than it has free slots.
3. **Accepts on one listener are exclusive waiters.** One arriving
   connection wakes one waiter. A ring whose accepts were armed before the
   backlog filled is never told about connections already queued. With every
   ring armed, the rings that filled took the last wake-ups, and the others
   slept while 38,000 connections sat in the backlog. The fix is one
   accepting ring at a time. Moving the job is a fresh submission, which the
   kernel tries at once, so it drains what is queued.
4. **A `DEFER_TASKRUN` ring runs at most 20 queued completions per
   `io_uring_enter`.** `io_run_local_work_locked` passes
   `max(IO_LOCAL_TW_DEFAULT_MAX, min_events)`, where `IO_LOCAL_TW_DEFAULT_MAX`
   is 20 (`io_uring/io_uring.c:125`). The rest stay queued, and the ring's
   eventfd is not signalled again: `io_req_local_work_add` signals only when
   the list goes from empty to non-empty. A loop that sleeps once the CQ is
   empty leaves that ring asleep until new work arrives. Measured: one ring of
   four sat with 20,000 connections unaccepted. With
   `IORING_SETUP_TASKRUN_FLAG`, `io_run_local_work_continue` sets
   `IORING_SQ_TASKRUN` while work is left, and the loop enters again until it
   clears. Correction (S1): the completions an enter posts may signal the
   eventfd, but a loop may not count on it: on 7.0 a signal deferred from a
   nested context sets a bit nothing clears, and every later signal for that
   registration is lost (NURING-8, `docs/security/net-uring.md`). The rule is
   that a loop does not sleep while a ring is flagged, and never sleeps on a
   ring set longer than `nish_uring_sleep_ms` answers (at most 10 ms), so the
   timer wakes it where the eventfd does not. Without the re-entry, S1's layer is the first kind, and one wait
   took 20 of a ring's 100 queued receives on 6.18.44. The `taskrun` check
   in `tests/runtime/uring-test.c` asserts that one wait takes all 100.

## 3. Stage A: the measurement

### 3.1 What runs

`bench/fd-limit/` is C with no Nish in it and no liburing. It makes raw
syscalls against `<linux/io_uring.h>`, as the runtime would.

- **`uring-server.c`**: one process, one thread, N rings. Each ring has a
  sparse file table of `limit` slots and a provided-buffer ring of 4,096 ×
  1 KiB. Accepts are single-shot into `IORING_FILE_INDEX_ALLOC`, 32 in flight
  on the one accepting ring. Each connection has one multishot recv into the
  buffer ring, and sends go to the fixed file with
  `IOSQE_CQE_SKIP_SUCCESS`. The ring flags are `SINGLE_ISSUER`,
  `DEFER_TASKRUN`, `TASKRUN_FLAG` and `SUBMIT_ALL`. With more than one ring,
  the thread sleeps in `epoll_wait` on one eventfd per ring
  (`IORING_REGISTER_EVENTFD`). With one ring, it sleeps in `io_uring_enter`.
  Once a second it prints its table's live count and its own `/proc/self/fd`
  count.
- **`epoll-server.c`**: P forked processes, each with its own `SO_REUSEPORT`
  listener and a level-triggered `epoll_wait` loop of 1,024 events. This is
  the shape `nish/net/prefork` and `nish/net/handler` give the entry.
- **`loadgen.c`**: C connections from `ceil(C / 19,000)` client processes.
  Each process binds its own loopback source address (127.0.0.10, .11, …)
  with `IP_BIND_ADDRESS_NO_PORT`, so no source and destination pair runs out
  of ephemeral ports. Once all are up, it sends at a fixed total rate,
  round-robin over the connections with no request outstanding. Then it
  measures the server pids over a window after a warm-up:
  - user and system time from `/proc/<pid>/stat`;
  - RSS and PSS;
  - their `/proc/<pid>/fd`;
  - the whole box's non-idle and softirq time from `/proc/stat`.
- **`run.sh`**: interleaved rounds that rotate the order of three designs:
  `uring`, `epoll`, and `epoll-copy`, a byte-identical copy of the epoll
  binary. The spread between `epoll` and its copy is the noise band
  ([.claude/testing.md, "A `Measured:` trailer"](../.claude/testing.md#a-measured-trailer)).

Both servers answer every request with the 129 bytes `bench/http1-server.ts`
gives `GET /plaintext`: `Server: nish`, `Content-Type: text/plain`,
`Content-Length: 13`, a `Date`, and `Hello, World!`. The client sends the
49-byte request wrk sends. The response is fixed, so neither server parses
more than the blank line.

**Why a fixed rate.** A closed loop at full speed measures throughput, and
batch size then decides CPU per request. The question here is what holding C
mostly-idle keep-alive users costs at the same offered load. At 30,000
requests a second, the box runs well below saturation at every C, so neither
design is CPU-bound and both see the same arrivals.

### 3.2 The box

| | |
| --- | --- |
| CPU | Intel Xeon Processor @ 2.30 GHz (family 6, model 173), 4 vCPUs, one thread a core |
| VM | KVM (Firecracker), the programs in a container on it, 15.7 GiB |
| Kernel | Linux 6.18.44, `io_uring_disabled` 0 |
| Mitigations | `mitigations=auto,no_guest_host,no_guest_guest`; `spec_store_bypass`, `spectre_v1` and `spectre_v2` mitigated, the rest "Not affected" |
| Descriptor limit | hard 20,000, no `CAP_SYS_RESOURCE`: `prlimit --nofile=65535:65535` is refused, so both designs run under `prlimit --nofile=20000:20000` |
| Compiler | gcc 13.3, `-O2` |
| Changed for the run | `net.ipv4.ip_local_port_range` 32768–60999 → 1024–65000; `net.core.somaxconn` 4096 → 65535; `net.ipv4.tcp_max_syn_backlog` 1024 → 65535; `net.netfilter.nf_conntrack_max` 262144 → 1048576 (count 0: nothing tracks loopback here) |
| Load | 30,000 requests a second at every C; 3 s warm-up, then a 10 s window; 5 rounds, the order of the three designs rotated each round |
| Commit | `d2bcd226` (`run.sh`'s live column fixed after; the figures do not use it) |

Command: `bash bench/fd-limit/run.sh`, 75 runs.

### 3.3 Figures

Server CPU is the user plus system time of the server's own processes over
the window, divided by the responses the clients received in it. Median of 5,
with min–max. User and sys are means. "Box" is every CPU's non-idle time over
the same window, client included; softirq is the box's softirq part of it.
PSS is the server processes' proportional set size, summed. "Box memory" is
`MemTotal − MemAvailable`: both ends of every connection, the client
processes, and the rest of the VM. Every run held all C connections for the
whole window. No request was ever due on a connection still waiting for its
response, and no connect failed.

| C | Design | Rings / processes | Server descriptors | Server µs/req | User / sys | Box µs/req | Softirq µs/req | Server PSS MB | Box memory MB |
| ---: | --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: |
| 18,000 | io_uring | 1 | 5 | **9.10** (7.73–11.33) | 0.17 / 9.45 | 19.27 | 10.16 | 5.7 | 724 |
| | epoll | 5 | 18,025 | **12.37** (11.17–16.13) | 0.51 / 12.66 | 25.83 | 14.53 | 0.9 | 703 |
| | epoll copy | 5 | 18,025 | 12.37 (12.00–16.03) | 0.59 / 12.67 | 26.27 | 14.92 | 0.9 | 708 |
| 60,000 | io_uring | 3 | 11 | **11.43** (9.87–12.47) | 0.13 / 11.01 | 21.13 | 10.49 | 16.3 | 1,014 |
| | epoll | 5 | 60,025 | **12.47** (12.13–13.47) | 0.51 / 12.20 | 26.27 | 12.41 | 0.9 | 966 |
| | epoll copy | 5 | 60,025 | 12.50 (11.70–13.20) | 0.49 / 11.85 | 26.07 | 11.77 | 0.9 | 975 |
| 96,000 | io_uring | 5 | 15 | **11.60** (10.13–12.13) | 0.17 / 11.28 | 21.60 | 11.15 | 27.0 | 1,266 |
| | epoll | 5 | 96,025 | **14.50** (12.57–15.27) | 0.57 / 13.51 | 29.43 | 12.60 | 0.8 | 1,191 |
| | epoll copy | 5 | 96,027 | 14.70 (12.53–16.37) | 0.65 / 14.08 | 27.43 | 12.67 | 0.9 | 1,182 |
| 120,000 | io_uring | 6 | 17 | **12.73** (11.43–13.30) | 0.18 / 12.41 | 25.73 | 12.96 | 32.3 | 1,427 |
| | epoll | 7 † | 120,035 | **17.27** (15.30–17.60) | 0.77 / 15.83 | 33.90 | 14.65 | 1.1 | 1,351 |
| | epoll copy | 7 † | 120,035 | 16.60 (14.67–17.33) | 0.86 / 15.27 | 32.73 | 14.41 | 1.1 | 1,332 |
| 300,000 | io_uring | 15 | 35 | **15.10** (14.03–15.73) | 0.35 / 14.68 | 29.60 | 15.44 | 80.3 | 2,698 |
| | epoll | 16 † | 300,080 | **24.77** (22.62–26.17) | 1.21 / 23.19 | 44.43 | 17.08 | 2.0 | 2,445 |
| | epoll copy | 16 † | 300,080 | 24.07 (22.07–25.23) | 1.27 / 22.73 | 43.90 | 16.95 | 2.0 | 2,447 |

† More than the entry's five processes. At a hard limit of 20,000, five
processes hold at most 99,840 connections. On the box, five would hold
327,000.

The noise band is the gap between the medians of `epoll` and its
byte-identical copy. It is also given here per round, paired, the stricter
reading: the largest gap between the two in any one round. The saving is
`(epoll − io_uring) / epoll`, at the medians, and in the round where it was
smallest.

| C | Saving at the medians | Band at the medians | Smallest saving in a round | Largest paired band in a round |
| ---: | ---: | ---: | ---: | ---: |
| 18,000 | 26.4% | 0.0% | 8.4% | 15.5% |
| 60,000 | 8.3% | 0.2% | 3.3% | 12.0% |
| 96,000 | 20.0% | 1.4% | 7.7% | 30.2% |
| 120,000 | 26.3% | 3.9% | 16.8% | 15.7% |
| 300,000 | 39.0% | 2.8% | 31.9% | 8.9% |

What the rows say:

- **The gap is not thin batches.** With five epoll processes throughout
  (18k to 96k), each one's share grows from 3,600 to 19,200 connections, and
  the io_uring server's saving stays between 8% and 26%: 26.4% at 18k and
  20.0% at 96k. Fuller epoll batches did not close it. The brief asked
  whether part of the entry's 22–26% at 18k was thin batches. On the
  transport alone, little of it is.
- **Epoll's cost grows with C, and the rings' grows more slowly.** From 18k
  to 300k, io_uring goes from 9.10 to 15.10 µs a request (+66%), and epoll
  from 12.37 to 24.77 µs (+100%). Above 96k, part of epoll's growth is the
  extra processes (†).
- **Nothing moved into softirq.** The box column, which includes the
  client's work and all softirq time, falls by more than the server column at
  every C: by 6.6 µs against the server's 3.3 at 18k, and by 14.8 µs against
  9.7 at 300k.
- **Memory.** The io_uring process is the larger one, at 80 MB at 300k. Each
  of its 15 rings has a 4 MiB provided-buffer ring and a 1 MiB CQ, sized for
  this benchmark. The box used 253 MB more with io_uring at 300k (2,698
  against 2,445 MB), about 0.8 KB a connection, of which the buffer rings and
  CQs are 75 MB. From the slope between 18k and 300k, both ends of a loopback
  connection cost about 6.2 KB with epoll and 7.0 KB with io_uring, client
  included.
- **Where the saving comes from** was not profiled. The prototype makes no
  recv syscall per request, since the multishot recv stays armed, and it
  submits a batch's sends in one `io_uring_enter`. It also wakes one thread
  rather than one of 5 or 16 processes. S4 re-measures this with the
  application on top and a profile.

### 3.4 Holding more than 65,535

Under `prlimit --nofile=20000:20000`, the io_uring server held every
connection the clients opened, up to 300,000. That is 4.6 times the box's
65,535, and 15 times this container's limit. Its own report during the
300k window, from its table's live count and `/proc/self/fd`:

```
live 300000 fds 35 ring 20000/20000/20000/20000/20000/20000/20000/20000/20000/20000/20000/20000/20000/20000/20000
```

The load generator read the same 35 from `/proc/<pid>/fd`: the listener, 15
rings, 15 eventfds, the epoll descriptor and three standard streams. The epoll
server's table is one descriptor per connection plus five per process, which
is why it needs a process per 19,968 connections here.

Nothing capped C below the brief's 300,000. At 300k the box used 2.7 of
15.7 GiB, and the clients connected in under 3 s. The raised port range was
not needed: each client process has its own source address and fewer than
19,000 connections, under even the default 28,232 ports. The raised listen
backlog absorbs the connect burst.

### 3.5 What this does and does not show

- It measures the transport alone: accept, recv, send and the wait. The
  entry's 34.5 and 43.4 µs per request include the application and SQLite.
  The prototype's gap is a lower bound on what the runtime can save per
  request. It is not a prediction of the entry's score.
- Loopback puts the client's TCP work on the same four vCPUs. The server's
  user and system time, read from `/proc/<pid>/stat`, includes the part of
  loopback softirq work that runs in the server's context, for both designs.
  The box columns, which include the client, are there to show that neither
  design moved cost into softirq time the per-process figures miss.
- It was measured on a 4-vCPU Firecracker VM on Linux 6.18. It was not
  measured on the benchmark box, a Xeon Platinum 8260 VM on Linux 6.8. 6.8
  has every feature in §2. Entry cost on that box is unmeasured (#1092).
- The hard limit here is 20,000, not 65,535, and the container cannot raise
  it. Both designs run under the same `prlimit --nofile=20000:20000`. The
  io_uring server needs `ceil(C / 20,000)` rings where the box would need
  `ceil(C / 65,535)`. The epoll server needs `max(5, ceil(C / 19,968))`
  processes where the box would run 5 up to 327k. So above 99,840
  connections the epoll design here runs more than five processes. §3.3
  marks those rows, and §4 reads the verdict both at the highest C and at
  96,000, the highest C where the epoll design runs as the entry does.

## 4. The verdict

**Go.** Both halves of the rule hold.

1. **Past 65,535 under the limit.** One process held 300,000 established
   sockets under a hard limit of 20,000, with 35 entries in its descriptor
   table (§3.4).
2. **Cheaper at the highest C reached, by more than the noise band.** At
   300,000 the io_uring server spent 15.10 µs a request against 24.77 µs for
   epoll: 39.0% less against a 2.8% band. Every round saved at least 31.9%,
   and the largest paired band in any round was 8.9%.

At 300k the epoll design ran 16 processes rather than the entry's 5, because
this box's limit is 20,000 (§3.5). So the reading closest to the box's shape
is 96,000, the largest C where five processes fit. There the saving is 20.0%
against a 1.4% band, at the medians. The per-round reading there is weaker:
the smallest saving in a round was 7.7%, under one noisy round's 30.2%
paired band. Both readings clear the rule as `run.sh` states it, which
compares medians.

What the verdict does not say: that the entry will score 300k users, or
that one process beats five on the entry's own workload. The prototype is the
transport alone (§3.5). S4 re-measures with SQLite and the router on top,
under the same rule, before the entry switches.

## 5. The proposed `nish:net` surface

### 5.1 What the program sees

Today a connection is an `i32` descriptor, and every `nish:net` call takes
one. A *handle* replaces the descriptor without changing the type. A handle
below 2^20 is a descriptor, as now: `fs.nr_open` caps descriptors at 2^20, so
none is larger. A handle of 2^20 or above is a ring slot,
`2^20 + ring × 2^20 + slot`, and fits an `i32` up to 2,046 rings. Errors stay
negative. A program that compares a connection with `0` or uses it as an
index keeps working. A program that hands one to `sendFd`, or to a C library
through `nish:ffi`, gets -9 (`EBADF`) for a slot handle, because a slot is not
a descriptor in the process's table.

A listener opts in with one new `tcpListenFlags` bit:

```typescript
import { tcpListenFlags, tcpAccept, NET_LISTEN_RING } from "nish:net"

// Bit 8: accept connections into io_uring slots where the kernel allows it.
const listener: i32 = tcpListenFlags("0.0.0.0", 8080, 4096, 1 | NET_LISTEN_RING)
const conn: i32 = tcpAccept(listener, peer) // a slot handle, or a descriptor on fallback
```

The bit is opt-in because a slot handle is not a descriptor (`sendFd`, FFI),
and because a program that never needs more than `RLIMIT_NOFILE`
connections gains nothing measurable from it (#1543). Bits 1, 2 and 4 were
taken (`SO_REUSEPORT`, `TCP_NODELAY`, steering), so the ring bit is 8, and
`(uint32_t)flags > 15` answers -22 (`nish_tcp_listen_flags` in
`runtime/runtime-net.c`). A runtime from before S2 refuses 8, so a program
built for the new runtime and run on an old one fails closed with -22.

`netRead`, `netWrite`, `netClose` and `netLocalPort` take either kind
(`netSetOption` was planned to as well; S2 has it answer -95, below). A slot handle keeps the readiness contract every `nish:net`
caller is written against:

- **`netRead(conn, buf, off, n)`** copies out of the bytes the ring's
  multishot recv has already delivered into provided buffers, returns them
  with the buffer recycled, and answers -11 when none are queued. `0` is end
  of stream. That is one copy, the same one `read(2)` makes.
- **`netWrite(conn, buf, off, n)`** copies into a per-connection send area
  and queues one `IORING_OP_SEND` on the fixed file. It answers `n`, or -11
  when that area is full. The copy exists because the caller may reuse `buf`
  as soon as the call returns. The area is bounded, and a full one is
  backpressure, as a full socket buffer is today.
- **`netClose(conn)`** queues `IORING_OP_CLOSE` on the slot
  (`file_index = slot + 1`) and frees the handle.

*As built in S2:* `netWrite2` takes either kind too, and `netSetOption`
answers -95 for a slot handle: the socket is the ring's fixed file, and no
`setsockopt` reaches it from the caller. The send area is 256 KiB a slot
(`NR_AREA`), and a slot's received bytes queue to the same bound before its
recv is cancelled until `netRead` drains half of them (NURING-9).

### 5.2 `pollCreate`

`pollCreate`, `pollAdd`, `pollWait` and `pollRemove` keep their signatures.
A loop holds two sets: descriptors in epoll, and slot handles in a table the
runtime keeps. `pollWait(loop, ready, timeoutMs)` works like this:

1. Each ring's eventfd sits in the loop's epoll set, so one `epoll_wait`
   sleeps on both kinds, for no longer than `nish_uring_sleep_ms` answers:
   0 while a ring is flagged or has work a submission could take, and at
   most 10 ms otherwise. The eventfd is a hint, not a wake the kernel
   guarantees (NURING-8); the bound is. A `pollWait` of -1 that wakes by
   the bound with nothing ready sleeps again.
2. On wake, for each ring whose eventfd fired, or whose `IORING_SQ_TASKRUN`
   is set (§2, item 4), it enters the ring with `GETEVENTS` and reaps. A recv
   CQE marks its handle readable, and a send's completion that frees area
   marks it writable.
3. It fills `ready` with the handle and event pairs for both kinds, in the
   order they arrived, up to its length.

Readiness is level-triggered, as today: a handle with queued bytes stays
readable until `netRead` drains it. A program cannot tell a slot from a
descriptor by what `pollWait` reports. The loop's own descriptors are one
epoll descriptor plus two per ring, so a loop at 300k connections under a
65,535 limit holds about 15.

A loop that holds one ring and at most `signalFd()` skips step 1's eventfd
and epoll, and sleeps in `io_uring_enter` on the ring itself (§5.5).

### 5.3 `nish/net/handler` and `nish/net/prefork`

`nish/net/handler` already drives connections through `pollWait`, `netRead`
and `netWrite`. Its change is two settings:

- `HandlerLimits` takes the listener flag;
- its slot table may exceed `RLIMIT_NOFILE`, so the cap moves from the limit
  to `HandlerLimits`.

Its behaviour at the limit changes with it. Today a full descriptor table
answers -24 and the handler waits for a close (#1548). A full set of rings
answers -23 (`ENFILE`) from `tcpAccept`, and the handler waits the same way.

`nish/net/prefork` does not change. Each worker opens its own listener, as
now. With the bit set, each worker holds as many connections as its rings
allow. The bit and prefork are independent: the entry can run one process
past 65,535 connections, or several. §3 says which of those is cheaper.

### 5.4 The fallback

The runtime tries the rings on the first `tcpListenFlags` call that sets the
bit, and falls back to descriptors, silently and for the whole process, when
any of these holds:

- the platform is not Linux. macOS keeps kqueue and wasi has no sockets, so
  the bit is accepted and does nothing;
- `io_uring_setup` answers `-ENOSYS`, or the kernel lacks a flag in §2. That
  shows as `-EINVAL` from setup, or as a missing feature bit;
- `io_uring_setup` answers `-EPERM`. That is `kernel.io_uring_disabled` set
  to 2, or set to 1 without membership of `kernel.io_uring_group`, or a
  container's seccomp profile. Docker's default profile refuses the three
  io_uring syscalls;
- registering the sparse table or the buffer ring fails.

`netRingState(): i32` answers why: 1 when rings are in use, or the negative
errno that caused the fallback. A server can log it once. The answer is not
an error, because the server works either way, only capped at
`RLIMIT_NOFILE` connections.

The fallback is checked by a test that runs the same program with
`io_uring_setup` refused. The test uses a seccomp filter the harness
installs, and expects descriptor handles and `netRingState() === -1`.

### 5.5 The batch wait and the direct ring wait

*Landed after S5.* Two changes to how a ring loop sleeps, neither visible in
what it answers.

**The direct wait.** A loop whose sources are one live ring set with one
ring, plus at most `signalFd()` watched for reading, sleeps in one
`io_uring_enter(GETEVENTS | IORING_ENTER_EXT_ARG)` with the wait's timeout in
the argument struct, rather than on the ring's eventfd through `epoll_wait`.
The enter flushes the submissions and runs the ring's task work itself, so
each sleep costs one system call where it cost two and an eventfd read.
Each enter is bounded as every ring sleep is (below), so a long wait is a
run of enters, one per `UR_SLEEP_MAX_MS` while slots are live.
`signalFd()` is watched by a one-shot `POLL_ADD` in the same ring, armed
once and re-armed after it answers; when it answers, the wait reads the
loop's epoll set without sleeping, and the signal is reported as before.
NURING-8's bound stays: the timeout given to the enter is what
`nish_uring_sleep_ms` allows, at most `UR_SLEEP_MAX_MS` (10 ms) while slots
are live, and NURING-14's re-check of `IORING_SQ_TASKRUN` runs on every pump
as it did. The wait goes through epoll as before on a kernel without
`IORING_FEAT_EXT_ARG` (before 5.11), on a set that has grown a second ring,
with a second live set or any other descriptor in the loop, when
`signalFd()` sits beside a ring `--sandbox` restricted, whose restrictions
refuse `POLL_ADD` (NURING-45), and for good once `netClose` or `fileClose`
has closed `signalFd()`, whose number may then name a new descriptor the
ring's poll would never report (NURING-48, NURING-49). A poll that answered
before a wait began, reaped by an earlier pump, ends that wait without an
enter rather than after one sleep. One narrow overlap is left: with a
`ready` of 2, the read of the loop's epoll set after the poll answers may
report the set's own eventfd, a pair `pollWait` drops. The call then
answers 0 and the next wait reports the signal only when its timeout is 0
or already spent; with time left, `nr_poll_wait` loops and the same call
reads the pipe on its next pass.

**`pollWaitBatch(loop, ready, timeoutMs, minEvents, maxWaitMs)`** waits as
`pollWait` does for the first event, then, with one live ring set, up to
`maxWaitMs` more until `minEvents` pairs are in or `ready` is full. The
kernel's own form of this, `min_wait_usec` in the same argument struct
(6.12, `IORING_FEAT_MIN_TIMEOUT`), waits for `min_complete` completions or for `min_wait_usec` once the
first is in, inside one enter. The runtime does not use it, and the call
makes two waits instead, for three reasons:

- a completion is not a pair: a recv completion and a send completion on one
  slot are one pair, and an accept is a pair only on the listener, so the
  count the kernel waits for is not the count the program asked for;
- `min_wait_usec` needs 6.12, and the batch should behave the same on the
  6.1 the ring layer needs;
- the first wait must still hear the loop's ordinary descriptors, which the
  second wait does not.

The cost of the second shape is that an ordinary descriptor that becomes
ready during the second wait is reported up to `maxWaitMs` late. That bound
is the documented one. A loop whose only descriptor is `signalFd()` hears it
through a `poll(2)` on it and ends the batch at once, but only on the direct
wait: wherever the paragraph above sends the wait through epoll, the signal
too waits up to `maxWaitMs`. The second wait sleeps in at most eight slices
of `maxWaitMs / 8`, rounded up, without entering the ring, and after each
pumps the set once and collects once. It first passed the pairs still
missing as an enter's `min_complete`, but a DEFER_TASKRUN enter wakes to run
task work for each completion, sends' included, so a window that bytes
trickled into woke, pumped and collected once per completion (16 waits and
62 enters in the trickle check, where the slices take 4 and 39). The cost
of the slices is that a batch can end up to one slice after `minEvents`
became ready. Tests: `uring`'s
"direct" mode, `link/net_ring_batch` (run with every epoll wait refused, so
a batch that fell back to epoll would fail), `net_poll_batch`.

## 6. The sandbox

### 6.1 Today

`--sandbox` kills `io_uring_setup`, `io_uring_enter` and `io_uring_register`
(425, 426, 427) unless both `net` and `process.spawn` are granted
(`runtime/runtime-sandbox.c:194`, `:442-444`;
[sandbox.md](security/sandbox.md), "The mapping"). The reason given is that
io_uring opens, connects and accepts sockets without making those syscalls,
so the `net` row, which kills `socket`, `connect`, `bind` and the rest, never
sees them. The same holds for files: `IORING_OP_OPENAT` makes no `openat`.
Landlock still applies, because its hooks are LSMs on the file, not
syscalls. The pair of grants is the line because a program granted both can
already do anything a ring could, by spawning a process that does it.

### 6.2 The rule this note proposes

When `net` is granted, io_uring is allowed, but only through rings the
runtime restricted before the filter loaded.

1. **Rings are made before the filter.** When `--sandbox` grants `net` and
   the program uses `NET_LISTEN_RING`, the sandbox step creates its rings
   first. That step is `nish_sb_seccomp`'s caller, before `main`
   (`runtime/runtime-sandbox.c:833`). How the runtime knows, and how many
   rings it makes, is §11, D2.
2. **Each ring is restricted.** It is created with `IORING_SETUP_R_DISABLED`
   and given `IORING_REGISTER_RESTRICTIONS`. Then its sparse table and buffer
   ring are registered, and it is enabled with `IORING_REGISTER_ENABLE_RINGS`.
   The restrictions are:
   - `IORING_RESTRICTION_SQE_OP` allows only `ACCEPT`, `RECV`, `SEND`,
     `CLOSE`, `ASYNC_CANCEL` and `NOP`. `SOCKET`, `CONNECT`, `BIND`,
     `LISTEN`, the `OPENAT`s, `SPLICE`, `MSG_RING`, the `URING_CMD`s and every
     opcode added later are refused (`io_check_restriction`,
     `io_uring/io_uring.c:2112`, tests a bitmap, so a new opcode is refused by
     default).
   - `IORING_RESTRICTION_SQE_FLAGS_ALLOWED` is `IOSQE_FIXED_FILE`,
     `IOSQE_BUFFER_SELECT` and `IOSQE_CQE_SKIP_SUCCESS`. Linking, draining
     and forcing async are refused. `SQE_FLAGS_REQUIRED` cannot be
     `IOSQE_FIXED_FILE`, because `io_close_prep` answers `-EBADF` to a close
     with that flag (`io_uring/openclose.c`).
   - `IORING_RESTRICTION_REGISTER_OP` allows nothing. Every registration
     happens before the ring is enabled.
3. **Every allowed opcode is a syscall `net` already allows.** The listener
   is made by `socket`, `bind` and `listen` in seccomp's sight. An `ACCEPT`
   on it is `accept4`. A `RECV`, `SEND` or `CLOSE` on a descriptor or slot is
   `recvfrom`, `sendto` or `close` on a socket the process holds. The ring
   adds where a connection lives, not what the program may do with it.
4. **The filter then kills `io_uring_setup` and `io_uring_register`.** It
   allows `io_uring_enter` only when its first argument, the low word of
   `args[0]`, is the descriptor of a ring step 1 made, and kills it on any
   other descriptor, or always when no ring was made. Without `net`, all three stay killed, as now. With
   `net` and `process.spawn`, nothing changes. A program cannot make a ring of
   its own, cannot lift a ring's restrictions (they are set once, before the
   ring is enabled: `io_register_restrictions` requires
   `IORING_SETUP_R_DISABLED`, `io_uring/register.c:162`), and cannot register
   anything.

**Why this is safe.** Under `net` the program may already accept, read,
write and close sockets. A restricted ring can do those things and nothing
else, and only on slots that hold sockets from the process's own listeners.
`io_uring_enter` on a descriptor that is not one of the runtime's rings
dies of SIGSYS: the kernel's own answer, `-EOPNOTSUPP` for a file that is
no ring (`io_uring/io_uring.c:3484`), would not stop a ring made outside
the sandbox and inherited across `exec` (NURING-35), and the program cannot
make another ring. The filter matches numbers, not files, so it also keeps
each premade ring's number from being closed or replaced: `close`, `dup2`
and `dup3` onto one kill, and a closed listener's ring is dropped by
`dup3` of a keeper ring, which takes only NOP, onto its number, so no ring
number is ever free for `dup` or `fcntl(F_DUPFD)` (NURING-36). A program that gets hold of a ring's descriptor through
`nish:ffi` can submit only what the restrictions allow, which is what
`nish:net` does anyway. A `SEND` with a destination address is a `sendto`
with one. On a TCP socket the address is ignored, and on a UDP socket it is
what `udpSend` may already do under `net`. What the rule gives up is the defence-in-depth of a syscall-number filter on the hot
path. The kernel's restriction check stands in for it, and that check has
been in io_uring since 5.10. The security record (§7) lists the io_uring
CVEs since 5.10, and whether a restricted ring of these opcodes reaches each
one.

### 6.3 What does not change

The x32 and arch kills, the `net` row's kills without `net`, Landlock's file
and network rules (the file rules apply to a ring too), and the outbound
allow-list for `tcpConnect`. Connects stay descriptors, because `CONNECT` is
refused on a ring. A client's sockets therefore stay bound by the limit. That
is acceptable, since the limit is a server's problem.

## 7. The security record

A new `runtime/runtime-uring.c` lands with `docs/security/net-uring.md` and
its row in [docs/security/README.md](security/README.md), in the same PR
(`node scripts/security-scope.mjs` refuses it otherwise). The record:

- **Scope.** `runtime/runtime-uring.c`, the slot-handle paths in
  `runtime/runtime-net.c`, and the sandbox rows that change in
  `runtime/runtime-sandbox.c`.
- **Threat model.** A peer that sends, stalls or resets. A program under
  `--sandbox` that reaches a ring through `nish:ffi`. A kernel that answers
  short, refuses, or overflows the CQ.
- **What to check, and test before and after:**
  - a stale handle after close: a slot's generation lives in the handle's low
    bits, or in the runtime table, so a closed handle answers -9 rather than
    reaching the next connection in that slot;
  - the accept bound (§2, item 2);
  - the `TASKRUN` re-entry (§2, item 4);
  - CQ overflow: `IORING_FEAT_NODROP` keeps CQEs, and the loop drains the
    overflow list;
  - a buffer-ring exhaustion answer (`-ENOBUFS`), which re-arms the recv
    rather than closing the connection;
  - a short or failed send, which is not skipped, because
    `CQE_SKIP_SUCCESS` skips only successes: a short send's remainder is
    re-queued;
  - each restricted opcode, refused with `-EACCES`;
  - `io_uring_setup` from `nish:ffi` under `--sandbox` dying of `SIGSYS`;
  - a full set of rings answering -23 without dropping an accepted
    connection.
- **The kernel's record.** Which io_uring CVEs since 5.10 a restricted ring
  of these six opcodes reaches, with the kernel version that fixed each.

`docs/security/sandbox.md` moves in the same PR: its scope, its mapping row
(`unless both net and process.spawn` becomes the three-way rule in §6.2), and
its Tests list. Its existing checks,
`sandbox: io_uring_setup from ffi without net dies of SIGSYS (strict)` and
`(best-effort)`, stay, and new ones join them.

## 8. Guide pages, tests and the C symbols

**Guide pages** that move with the implementation, not with this note:

- `docs/guide/using-nish/networking.md`, in "How many connections: the
  descriptor limit": the bit, what a slot handle is and is not (`sendFd`,
  FFI), `netRingState`, the fallback, and the -23 at a full set of rings. It
  also gets a line in "Sharing a port and turning Nagle off:
  `tcpListenFlags`" for bit 4.
- The `--sandbox` guide page's `net` row.
- `docs/reference/` regenerates from `runtime/nish.d.ts`.

**Tests**, each behind the kernel it needs. On a runner without io_uring the
section prints its skip line, and the runner's skip count is read as for
`wasi`.

- `net_ring_beyond_limit` (`tests/link/`): one process under
  `prlimit --nofile=1024:1024` accepts 3,000 loopback connections into rings
  and reports, by exit status, that its table holds 3,000 and its
  `/proc/self/fd` holds fewer than 64. CI's runner limits are not this
  container's, so the check sets its own limit and reads the program's
  status, never a count of the test process's descriptors
  ([.claude/testing.md, "Checks that spawn a process"](../.claude/testing.md#checks-that-spawn-a-process)).
  A second check does the same past 65,535 under
  `prlimit --nofile=65535:65535` where the runner's hard limit allows it,
  and otherwise under the runner's own hard limit with more than that many
  connections.
- The fallback (§5.4), the stale handle, the accept bound and the -23, each
  as one check.
- Negative tests under `--sandbox`: each refused opcode answers `-EACCES`;
  `io_uring_setup` and `io_uring_register` from `nish:ffi` die of `SIGSYS`
  with `net` granted; without `net`, the ring bit falls back and `netRingState`
  answers the kill's absence as `-EPERM`.
- The c-symbols section (`node tests/run.js c-symbols`) fails on any new
  undefined libc symbol in the runtime. Rings are driven by raw `syscall`
  with no liburing, and `syscall` is already reserved
  (`src/c-symbols.ts:772`). `eventfd` and `mmap`/`munmap` need entries in
  `isCLibrarySymbol` if they are not reserved already, in the same PR.
- The runtime budgets (`tests/runtime-budgets.js`): the ring path's object
  size, with the reason beside its ceiling.

## 9. Cheaper wins for the multi-process model

These help the five-process entry whatever the verdict, and none needs
io_uring:

- **`PRAGMA mmap_size`.** `scripts/build.sh` does not omit mmap. Its SQLite
  flags set neither `SQLITE_MAX_MMAP_SIZE` nor `SQLITE_DEFAULT_MMAP_SIZE`, so
  the amalgamation's Linux default applies: a maximum of 2 GiB and a default
  of 0 (`runtime/sqlite/sqlite3.c:16293-16312`). A program that runs
  `PRAGMA mmap_size=268435456` after opening reads pages through the shared
  page cache rather than copying them into each process's private SQLite
  cache. Five processes then share one copy of the hot pages, and a read
  skips one `pread` and one copy. It needs a measurement on the entry: reads
  should gain, while writes still go through the WAL and gain nothing. The
  pragma is per connection, so it needs no build change.
- **`nish/sync/shm` for shared state.** [WP47](wp47-shared-memory.md)'s
  regions (`createRegion`, `openRegion`, the atomics, the wake) let the
  workers share what each now computes or caches alone. That includes
  counters, a rate limiter's buckets and a small read-mostly cache, so that
  per-process state does not multiply by five.
- **Fewer processes only where the limit allows.** On the transport alone,
  fuller epoll batches did not close the gap (§3.3: 26.4% at 3,600
  connections a process, 20.0% at 19,200). Running three processes rather
  than five is therefore no substitute for rings. It is worth measuring only
  for the SQLite cache it saves.

## 10. Stages

Each stage is one PR. Each is gated by the tests §8 names for it.

1. **S1: the ring layer, with no surface.** `runtime/runtime-uring.c`: setup
   with the §2 flags, the sparse table, the buffer ring, the eventfd, the
   bounded single-shot accept on one accepting ring, multishot recv, send and
   close on fixed files, the `TASKRUN` re-entry, and the fallback probe. It
   lands with its security record and with a C test of the layer under
   `prlimit` that holds more than the limit. Nothing calls it from `nish:net`
   yet.
2. **S2: slot handles in `nish:net`.** `NET_LISTEN_RING`, `netRingState`,
   the handle encoding, `netRead`, `netWrite` and `netClose` on slots, and
   `pollWait` over both kinds. Also `runtime/nish.d.ts` with doc comments,
   `docs/reference/`, the guide's networking page, the fallback, stale-handle
   and -23 tests, and `net_ring_beyond_limit`.
3. **S3: the sandbox rule.** The restricted rings made before the filter
   (§6.2), the new filter rows, the negative tests, and `sandbox.md` with its
   guide row.
4. **S4: the handler and the entry.** `HandlerLimits` takes the bit and a cap
   past the limit, and `bench/http1-server.ts` gains `BENCH_RING=1`. This
   stage re-measures the entry: one process with rings against five epoll
   processes, with SQLite, at 18k and at the box's C. It is gated on the same
   rule as §4. *Measured in S4* ([BENCHMARKS.md](https://github.com/amritk/nish/blob/main/docs/BENCHMARKS.md#io_uring-under-the-handler-wp63-s4)): `bash
   bench/handler-ring/run.sh`, 5 interleaved rounds, a stand-in that answers
   `GET /plaintext` with one SQLite lookup, under a hard limit of 20,000. One
   ring process spent 25.63 µs a request against 34.60 for five epoll
   processes at 18,000 (25.9% less, band 0.5%) and 26.20 against 37.17 at
   96,000, the box's C (29.5% less, band 0.7%), holding 96,000 connections with
   21 descriptors. Both halves of §4's rule hold: go. Its PSS was 518 MB
   against 129 MB at 96,000. *Re-measured after NURING-38*, which frees a
   slot's receive queue once it is drained and starts the next at 1,024
   bytes: `bash bench/handler-ring/run.sh --conns 96000 --compiler
   build/nish-test`, 5 rounds on the same box shape, read 141.4 MB against
   128.9 MB, and 21.76 against 29.27 µs a request (25.7% less, band 0.8%).
   *Tail latency* ([BENCHMARKS.md](https://github.com/amritk/nish/blob/main/docs/BENCHMARKS.md#the-rings-tail-latency-and-300000-connections)):
   `run.sh` now reports p50, p99 and p99.9 and takes `--think` for a
   closed-loop load. The entry's 65 ms p99 for one ring process, against
   20 ms for five epoll processes, does not reproduce on one shared core. In
   every round at every offered load from 30,000 to 56,250 requests a second
   at 90,000 connections (at `d603893d`), the ring process's p99 was below the five's, though
   from 45,000 up the five were saturated and their p99 is a backlog. One epoll
   process, which the box's hard limit of 20,000 descriptors caps at 19,936
   connections, is the control at 18,000 and the same rates: at 45,000 a
   second (at `877c503e`) its p99 was 27 to 40 ms against the ring's 7.1 to
   12.7, and at 36,000 (at `c1b8967f`) it was 4.7 to 4.9 against the ring's
   5.6 to 8.1, lower than the ring's, so one process on
   one core tails whatever it waits with. The tail is a queue,
   not a stall: in a traced run at 45,000 (`bench/handler-ring/trace.sh`,
   which applies `trace.patch` for one build; `runtime/` at `0c6cdaa7`,
   `bench/` at `1b3a92ee`) no pass of the loop took more than 8.60 ms inside
   the load window, but in one second a burst left at least 1,910 slots
   ready, with the oldest that second at most 26 ms old (an upper bound). The p99 is noisy: one design
   at one load moved by as much as 11.8x between rounds (epoll at 96,000;
   7.2x in the 90,000 sweep). No fix is made; a second core should
   shorten it, which is not measured. The final code at 96,000
   (`--conns 96000 --think 4 --rounds 3`, at `d603893d`) read 20.86 against 31.17 µs a
   request (33.1% less, band 0.8%), with a p99 of 1.74 against 8.83 ms.
   At 300,000 (`--conns 300000 --think 10 --rounds 3 --designs ring`, at
   `02230cc8`), one
   ring process held every connection with 47 descriptors, at 23.73 µs a
   request, 436 MB PSS and a p99 of 0.90 ms.
5. **S5: the cheaper wins** (§9), measured on the entry on their own. They do
   not depend on S1 to S4 and can land first. *Measured in S5*
   ([BENCHMARKS.md](https://github.com/amritk/nish/blob/main/docs/BENCHMARKS.md#the-cheaper-wins-for-five-processes-wp63-s5)):
   `bash bench/handler-ring/wins.sh --rounds 7`, on S4's stand-in as five
   epoll processes at 18,000 connections, each win on its own against the
   unchanged five. `PRAGMA mmap_size=268435456` spent 27.87 µs a request
   against 33.07 (15.7% less, band 0.6%; at least 11.3% less in every round),
   all of it system time, and did not lower memory: RSS rose from 49 to
   1,301 MB and PSS from 37 to 279 MB as the mapped file was counted against
   the workers, with the box's used memory unchanged. A like-count cache in
   one `nish/sync/shm` region spent 28.13 µs (14.9% less), answering 30.0% of
   requests without SQLite; the same cache held in each worker answered 7.3%
   and its 2.0% was not separable from noise, so the gain is the cache's, and
   sharing bought its fill rate from cold. Both are gains on the stand-in;
   rerun `wins.sh` on the entry before it adopts either.

## 11. Open questions

- **D4: the kernel's minimum wait.** `pollWaitBatch` makes two waits rather
  than one enter with `min_wait_usec` (§5.5). If the ring layer's minimum
  kernel moves to 6.12, the second wait could become the kernel's, for the
  case where every completion is one pair. It is not measured whether the
  saved enter matters next to the batch itself; `pollWaitBatch` keeps its
  contract either way.

- **D1: opt-in or default.** This note makes the ring bit opt-in (§5.1). If
  S4 shows the ring path no dearer at low C, the bit could become the default
  for listeners on Linux, with descriptors as the fallback. The cost is the
  `sendFd` and FFI difference. *Decided in S2: opt-in, until S4's numbers. Kept in S4: the ring path is
  not dearer at 18,000 or 96,000, so the numbers allow a default, but it costs
  about four times the memory a connection at 96,000 and no low C was measured
  beyond a one-round smoke run, so `HandlerLimits.ring` stays false by default.
  The memory has since narrowed: with an idle slot's receive queue freed
  (NURING-38) the ring process held 141.4 MB against 128.9 MB at 96,000,
  about 1.5 KB a connection against 1.3 KB. The default is still not changed:
  18,000 and a low C are not re-measured. The tail does not stand against a
  default either: at a matched load on one core the ring process's p99 was
  the lower one, at 18,000 (re-measured for its tail only: 1.65 to 1.78 ms
  against 2.08 to 3.17) and at 96,000. One epoll process, the control for
  one ring process, is not beaten: at 18,000 and 22,500 a second it read
  1.49 to 1.84 ms, overlapping the ring's 1.65 to 1.78, and at 36,000 it read
  4.7 to 4.9 ms against the ring's 5.6 to 8.1. What does stand is that one ring
  process has one core while five epoll processes can use five, so a default
  would want a ring process per core, which is not measured.*
- **D2: how many rings under `--sandbox`, and how the runtime knows.** The
  rings must exist before the filter loads, so their number is fixed at
  start-up, and the runtime must know before `main` that the program uses
  the bit: the compiler can record a reachable `NET_LISTEN_RING` in the
  binary, as it records other capability use. Two candidates: a
  build-time count from a `nish.json` setting, with 1 as the default, or
  `ceil(hard limit × k / limit)` for a declared connection ceiling. Without
  `--sandbox`, rings are made on demand. *Decided in S3: `netRings` in the root
  `package.json`'s `"nish"` field, 1 to 64, default 1 (NL3058 otherwise);
  the compiler passes 0 when `main` cannot reach the bit or `net`.*
- **D3: one thread or more.** This design is one thread with N rings, which
  keeps the single-threaded `nish:net` model WP42 §1 fixed. The top entry
  runs a ring per thread. Rings per thread would need `nish:net` inside
  `scope()` tasks, which WP42 refuses on purpose. That decision belongs to
  another note. *Decided in S2: one thread with N rings.*
