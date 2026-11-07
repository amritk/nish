# WP47: Shared work across cores — regions, atomics and rings

**Status: built.** `std/sync/shm.ts`, `std/sync/ring.ts`,
`runtime/runtime-shm.c`, `examples/prefork-jobs.ts`, `tests/link/sync_shm`,
`tests/link/sync_ring`, `tests/link/sync_shm_deny_ffi` and
`bench/ring-latency/`. [LANGUAGE.md](LANGUAGE.md#shared-memory-between-processes-nishsyncshm-and-nishsyncring)
is normative; this note records why the modules are shaped as they are and
what they measured. The security review is
[security/shm.md](security/shm.md).

A server that runs one process a core ([wp42](wp42-multicore-server.md)) has
had one way for those processes to talk: a socket. A socket costs two system
calls a message and a wake of the reader, which is tens of microseconds on a
virtual machine. A C or Zig server of the kind this is measured against
answers about 40,000 requests a second at 1 to 3 µs of its own time a request,
so a hop through a socket costs more than the work it carries. This note adds
memory that several processes map at once, atomics on it, a cross-process
wakeup, and two lock-free rings over them, and measures the rings against a
Unix socketpair.

Nothing changes for a program that does not import `nish/sync/shm` or
`nish/sync/ring`. The runtime half is a translation unit of its own,
`runtime-shm.c`, which the linker drops when nothing calls it. The compiler
gained nothing: both modules are ordinary Nish over a C surface.

## 1. Regions

```ts
import { createRegion, openRegion, unlinkRegion, RELEASE, ACQUIRE } from "nish/sync/shm"

const region = createRegion("jobs", 4096).expect("create") // zeroed, mode 0600
region.storeI64(0, toI64(42), RELEASE)

const view = openRegion("jobs").expect("open") // in any process of this user
const n: i64 = view.loadI64(0, ACQUIRE)
```

**Named, and nothing else.** The request listed three ways to make a region:
a name, an anonymous mapping made before `fork`, and `memfd` or `shm_open`.
Only the name is built, because the other two cannot reach a Nish child:

- A Nish program has no `fork`. `spawn` and `nish/net/prefork` start a
  program with `exec`, and an exec drops every mapping.
- Every descriptor the runtime opens is close-on-exec (`O_CLOEXEC`,
  `pipe2(O_CLOEXEC)`; [security/runtime.md](security/runtime.md)), so a
  `memfd` does not survive the exec either. Handing one across would mean a
  descriptor kept open on purpose, which the runtime does nowhere else.

A name does reach the child. The supervisor creates the region before
`preforkWith`, every worker opens it by name, and the supervisor unlinks it
once they have exited. `examples/prefork-jobs.ts` is that shape.

**What a name is.** A region is a POSIX shared-memory object:
`/dev/shm/<name>` on Linux, `shm_open("/<name>")` on Darwin, mapped
`MAP_SHARED`. A name is 1 to 30 characters of `A-Z a-z 0-9 . _ -` and does not
start with `.`, so it can never name a directory, a parent or a hidden file.
`createRegion` opens with `O_CREAT | O_EXCL | O_NOFOLLOW | O_CLOEXEC` and
mode 0600, so it never adopts an object someone else made. `openRegion`
refuses one this user does not own, one with any group or other mode bit,
and on Linux one that is not a regular file or has a second hard link, which
is how another user could make a name for one of ours (`SHM_ACCESS`). A size must be from 1 byte to 1 GiB; every offset is an `i32`.

**Lifetime.** The name stays until `unlinkRegion`, even after every process
that mapped it has exited, which is how a process started later finds it. A
mapping lasts until `close()` or until its process exits, when the kernel
unmaps it; no region outlives its process's address space. A run that was
killed leaves its name behind, so the example unlinks a stale one before it
creates its own.

**At most 63 regions open at once** (`SHM_TOO_MANY`), in a table the runtime
keeps a process, or a thread under `--threads`. A handle is an index and a
generation in that table, never a pointer. So a closed handle,
a handle from another process's table, or a forged one names nothing and
panics; it never reaches memory.

**Error codes are errno.** `SHM_NOT_FOUND` 2, `SHM_ACCESS` 13, `SHM_EXISTS` 17,
`SHM_INVALID` 22 and `SHM_TOO_MANY` 24, each with `strerror`'s text, in a
`ShmError` the `Result` carries.

## 2. Typed views, checked like arrays

A region has no typed array over it. It has accessors, each taking a byte
offset:

| Access | Slot | Orderings |
| --- | --- | --- |
| `loadI32`, `loadI64` | 4- or 8-byte, aligned | `RELAXED`, `ACQUIRE`, `SEQ_CST` |
| `storeI32`, `storeI64` | the same | `RELAXED`, `RELEASE`, `SEQ_CST` |
| `addI32`, `addI64`, `exchangeI32`, `exchangeI64`, `compareExchangeI32`, `compareExchangeI64` | the same | any of the five |
| `read(at, dst, off, len)`, `write(at, src, off, len)` | a byte window | plain copies |

Every access is checked, and a failed check panics rather than answering an
error, as an array index out of range does:

- a 32-bit slot sits at a multiple of 4 and a 64-bit one at a multiple of 8,
  wholly inside the region;
- a byte copy fits both the region and the buffer;
- an ordering the access cannot take (a load with `RELEASE`, a store with
  `ACQUIRE`, a number that is no ordering) panics too.

```text
nish/sync/shm: slot offset 4093 is outside the region of 4096 bytes
nish/sync/shm: slot offset 6 is not a multiple of 8, the slot's width
nish/sync/shm: byte window at 4000 is outside the region of 4096 bytes
```

The checks are in C, beside the access. A check in Nish would cost a call
into the runtime for the region's size on every access. In C it is one
compare against a field already loaded, and the speed and size profiles
inline it into the program.

A misaligned atomic is a panic and never a bus error or a torn access, and
the same holds for an offset out of range. So a buggy peer, or a buggy
program, can make this process stop with a message, but cannot make it read
or write outside the region.

## 3. Atomics

The five orderings are C11's. Each accessor's C body is one `__atomic_*`
builtin, which clang lowers to one LLVM `load atomic`, `store atomic`,
`atomicrmw` or `cmpxchg` at that ordering. The speed and size profiles compile
the runtime with the program and inline it, so a slot access in a Nish loop
becomes that one instruction behind its bounds check. `fence(order)` is
`fence` at that ordering. A failing compare-exchange orders as C++ derives it:
`ACQ_REL` fails as `ACQUIRE`, and `RELEASE` fails as `RELAXED`.

`compareExchangeI32` and `compareExchangeI64` answer the value they found,
never a flag, so a loop needs no second load:

```ts
let seen = region.loadI32(at, RELAXED)
while (true) {
  const was = region.compareExchangeI32(at, seen, seen + 1, ACQ_REL)
  if (was === seen) break
  seen = was
}
```

**Node.** The request asked for a `SharedArrayBuffer` fallback under
`--emit-ts` if it was cheap. It is not cheap, because it cannot do the job:
a `SharedArrayBuffer` crosses only to `worker_threads` in the same process,
and the point of a region is another process. A fallback that worked between
threads but not between processes would make `examples/prefork-jobs.ts`
compile for Node and then hang. So the refusal is the one `--emit-ts` already
gives every module that declares C functions, at compile time:

```text
--emit-ts cannot write a module that declares C functions; keep it native and import it through --emit-napi (wp33 §4.4)
```

A Node program that needs the native rings imports them through
`--emit-napi`. On wasi, `createRegion` and `openRegion` answer
`SHM_UNSUPPORTED` (-95), since wasi has no shared mapping between processes.

## 4. Waking another process

`waitI32(at, expected, timeoutMs)` sleeps while the 32-bit slot at `at` holds
`expected`. `wake(at, count)` wakes up to `count` processes sleeping on that
slot. On Linux these are `FUTEX_WAIT` and `FUTEX_WAKE` in the shared form, not
`FUTEX_PRIVATE_FLAG`: the kernel keys a shared futex by the page and offset,
so two processes that mapped the region at different addresses still meet.
The answers are `SHM_WOKEN` (0, which includes a signal that interrupted the
sleep), `SHM_NOT_EQUAL` (-11, the slot had changed already) and
`SHM_TIMED_OUT` (-110). A timeout below 0 waits for ever.

**No eventfd.** An eventfd is a descriptor, so it has the same problem as a
`memfd`: it is close-on-exec and does not reach a prefork worker. A futex
needs nothing but the address, which is already in the region. It is also
the cheaper of the two: an eventfd's wait is a `read` that always enters the
kernel, while a futex's waiter checks the value first.

**Darwin and wasi answer `SHM_UNSUPPORTED` (-95)** from both, as
`setIdlePriority` does on Darwin. Darwin's public wait-on-address
(`os_sync_wait_on_address`) arrived in macOS 14.4 and is not in every SDK
the build supports, and `__ulock_wait` is private API. The rings poll there
instead (§5). Regions and atomics work on Darwin; only the sleep is missing.

## 5. `nish/sync/ring`

Two bounded lock-free queues of byte records, each living at a 64-aligned
`base` in a region, so one region can hold several:

```ts
const ring = initSpscRing(region, 0, 65536, true) // the creator, once
ring.tryPush(job, 0, job.length) // false when full

const ring = attachSpscRing(region, 0).expect("ring") // any other process
const n = ring.popWait(buf, 0, 1000) // the length, or RING_EMPTY after 1 s
```

**The header** puts each counter on a cache line of its own. Bytes 0 to 15
hold the magic, the size and the slot size; byte 16 says whether the ring
has a doorbell. Byte 64 is the producers' position (i64), byte 128 the
consumer's, and byte 192 the consumer's "asleep" flag. Data starts at byte
256. A producer's stores and the consumer's never share a line.

**`SpscRing`**, one producer and one consumer, holds records of any length
back to back. Each record is a 4-byte length, then the bytes, rounded up to
4. The capacity is a power of two and positions are i64 byte counts that
never wrap, so `tail - head` is the fill and a record may straddle the end
of the data, copied in two parts. Each side keeps a copy of the other's
position and loads the real one only when its copy says full (the producer)
or empty (the consumer). A push in a ring with room is then one relaxed store
of the length, one copy and one release store of the tail.

**`MpscRing`**, many producers and one consumer, is Vyukov's bounded queue.
It has fixed slots of `[seq i64][len i32][4 unused][payload]`. A producer
claims slot `tail` with a compare-exchange on the producers' position, fills
it, and publishes it by storing `tail + 1` in the slot's sequence. The
consumer takes slot `head` once its sequence says so, and frees it for the
next lap by storing `head + slots`. Records of different lengths up to
`slotBytes` share the slots.

Both rings offer `tryPush`, `tryPop`, `popBatch(dst, lens)` and
`popWait(dst, off, timeoutMs)`. `popBatch` moves as many records as fit with
one load of the producers' position and one store of the consumer's.

**In place, on `SpscRing`.** `reserve(n)` lends the producer the ring's
next `n` bytes as a `u8[]` (a `SharedRegion.lend` window) and `commit(len)`
publishes the first `len` of them with the same stores as `tryPush`: a
relaxed store of the length, then the release tail store (sequentially
consistent, then the doorbell, on a ring with one). `abandon()` publishes
nothing. `peek()` lends the consumer the next record as a `readonly u8[]`
after the acquire load of the tail, and `release()` frees it with the
release store of the head that `tryPop` makes. Each end keeps one window
header and re-points it with `lend`'s `reuse`, so a busy ring allocates
nothing and makes no system call (a lend without `reuse` keeps 48 bytes,
SHM-6 in the security record). Every call answers at once: `reserve`
answers an empty window when there is no room, and `peek` when there is no
record.

A window is one run of bytes, so a reservation never straddles the end of
the data. One that would starts at the next lap, and the producer writes
the length word -1, a **skip marker**, in the rest of this one; every pop
path (`tryPop`, `popBatch`, `popWait`, `peek`) reads a marker as "the
record is at the start of the next lap" and steps over it. `n` is at most
`capacity / 2 - 4`, so the marker and the record always fit an empty ring.
`tryPush` still copies a record across the end in two parts, as before;
`peek` answers empty for such a record, and for one of length 0 (an empty
window is "nothing"), and `tryPop` takes it. The format keeps its magic
"nrs1": a consumer from before this change that meets a marker panics with
"the ring is corrupt" rather than misreading it, and both ends are normally
one build.

One reservation and one lent record at a time. A second `reserve`,
`tryPush` during a reservation, `commit` of more than was reserved, or
`peek`, `tryPop`, `popBatch` or `popWait` while a record is lent each panic
with a message that names the call (`popWait` reaches the panic through
`tryPop`, so it names `tryPop`); a `push` onto a window is caught only when
it is given back, at `commit` or `abandon`, as "a push moved it"; `reserve`
panics on a ring of 8, whose largest reservation (`capacity / 2 - 4`) is 0,
and a ring of 16 allows 4; the reserved bytes are not zeroed; `commit`, `abandon` and `release` give the
window back, so an index through it afterwards is the ordinary `index out of
range: i >= 0`, also inside a loop whose bound was the window's length.

**What is not checked, and what is.** Who calls what is not checked. Two
producers on an `SpscRing`, or two consumers on either ring, lose or repeat
records. That is a misuse the type cannot see across processes. They never
read or write outside the region, though, because every access is a checked
`SharedRegion` access. A length a peer wrote that cannot be a record (below
0, past the capacity, past what was published, or a skip marker with no
record after it) panics with "the ring is corrupt", naming the length and
the position (SHM-1 and SHM-7 in the security record).
An `MpscRing` producer that dies between claiming a slot and publishing it
stalls the consumer at that slot for good: the slot's turn never comes. The
supervisor that restarts a producer must make a fresh ring. A lock-free queue
that skipped a dead producer's slot would need a timeout and a way to tell a
slow producer from a dead one; neither belongs in the first version.

### The doorbell

A ring made with `doorbell` true lets its consumer sleep. `popWait` first
calls `tryPop` up to 2,048 times. Then it stores 1 in the asleep flag with
`SEQ_CST`, looks at the tail once more with `SEQ_CST`, and only if that is
still empty does it `waitI32(flag, 1, …)`. A push stores its tail with
`SEQ_CST` and then loads the flag with `SEQ_CST`. If the flag is set, the push
exchanges it to 0 and calls `wake`. That is Dekker's pattern: under
sequential consistency either the consumer's second look sees the record, or
the producer's load sees the flag, so a record is never left behind a
sleeping consumer. The exchange makes exactly one of several MPSC producers
pay for the wake.

So a busy ring makes **no system call**: the consumer finds a record while it
spins and never sets the flag, and no producer ever sees it set. An idle ring
makes two a record, the consumer's `futex_wait` and the producer's
`futex_wake`. A ring without a doorbell does a release store on push, and
`popWait` answers `SHM_UNSUPPORTED` after its spins, as it does off Linux;
the caller polls `tryPop`. `popWait` reads the monotonic clock for its
deadline, so an importer of `nish/sync/ring` reaches the `clock` capability
as well as `ffi`.

**The spin count was measured** on the ping-pong of §7, with each process
pinned to its own core:

| `RING_SPINS` | round trip p50 | p99 | mean |
| ---: | ---: | ---: | ---: |
| 256 | 580 ns | 29,970 ns | 4,923 ns |
| 2,048 | 790 ns | 1,320 ns | 886 ns |
| 8,192 | no better than 2,048 | | |

At 256 the consumer often fell asleep before the echo came back, and a futex
wake on this VM costs tens of microseconds. At 2,048 it rarely does: about
2 µs of polling covers a round trip a busy peer answers within. The p50 rose
by 0.2 µs because the median trip now spins more and sleeps less, but the
mean fell by a factor of 5.5 and the p99 by 23.

## 6. Threads instead?

The request asked whether long-lived threads would do this job better. Nish
already has them: `--threads`, `nish/threads`' scopes, `Channel<T>` and
`Mutex<T>` ([wp29](wp29-thread-surface.md)). The decision is to hand work
between **processes** through regions, and to keep threads for data
parallelism inside one process:

- **Isolation.** A panic in a Nish thread takes the whole program down: the
  first panic claims the exit. A panic in a prefork worker takes down that
  worker, and the supervisor can restart it. A server that hands work between
  cores wants the second.
- **Memory.** Each thread has its own arena, and an arena never frees
  ([wp46](wp46-long-running-memory.md)). A long-lived thread therefore grows
  until the process is killed, and it cannot be restarted on its own to give
  memory back. A worker process can.
- **Cost of a hop.** `Channel<string>` copies each string across arenas
  under a lock (`runtime-cross.c`). A ring copies raw bytes once into shared
  memory with no lock, and its busy path makes no system call. A channel
  could be made lock-free too, but its copy into the receiver's arena would
  stay.
- **It already exists.** `nish/net/prefork` (wp42) is how a Nish server uses
  every core today, with `SO_REUSEPORT` listeners. A region gives those
  workers a way to talk without changing how they start.

The two do not mix: the runtime's region table is thread-local under
`--threads`, so a `SharedRegion` handed to another thread names nothing there
and panics. That thread opens the name itself. This is a checked refusal,
not a race on the table.

## 7. Measured

`bench/ring-latency/` sends 16-byte messages between two processes, the
parent pinned to CPU 0 and the child to CPU 1, through an `SpscRing` pair
(`ring.ts`) and through an `AF_UNIX` `SOCK_STREAM` socketpair (`socketpair.c`,
`clang -O2`):

- **pingpong**: the parent sends, the child echoes, and the parent times the
  round trip into a 10 ns histogram (warm-up of a tenth first);
- **stream**: the parent sends as fast as the transport takes it and the
  child drains it (the ring with `popBatch`);
- **idle**: one message a millisecond, so the reader is asleep for every one.

Five rounds of every pair in a seeded shuffled order give the median and,
in brackets, the lowest and highest. The machine was a 4-core cloud VM on
Linux 6.18 with clang 18, on 2026-10-30.

| transport | round trip p50 (ns) | p99 (ns) | mean (ns) | stream (msgs/s) | idle (msgs/s) |
| --- | ---: | ---: | ---: | ---: | ---: |
| ring | 790 (740 to 810) | 1,320 (1,280 to 3,520) | 886 (870 to 999) | 6,740,872 (5,985,426 to 7,692,779) | 885 (875 to 892) |
| socketpair | 23,270 (23,150 to 23,510) | 60,010 (58,080 to 62,480) | 26,802 (26,539 to 27,697) | 925,014 (905,803 to 941,792) | 866 (857 to 894) |

`strace -f -c` counted the system calls a message costs, on the message path
only. In idle mode the ring bench's own 1 ms sleeps are a futex wait each, so
those n calls are subtracted:

| transport | mode | messages | calls | per message |
| --- | --- | ---: | ---: | ---: |
| ring | stream | 1,000,000 | 163 futex | 0.0002 |
| ring | idle | 500 | 1,002 futex | 2.004 |
| socketpair | stream | 1,000,000 | 2,000,007 read + write | 2.000 |
| socketpair | idle | 500 | 1,007 read + write | 2.014 |

What this says:

- **A round trip through the ring is 29 times faster at the median** (0.79 µs
  against 23.3 µs) and 45 times at p99. That puts it inside the 1 to 3 µs a
  request the reference C or Zig server spends on its own work, where a
  socket hop alone costs ten of them. At 40,000 requests a second, a request
  has 25 µs. A ring hop there and back is 3 % of that budget, and a socket
  hop is 93 %.
- **Streaming is 7.3 times the socketpair's rate**, 6.7 million 16-byte
  messages a second through one SPSC ring, which is 170 times the reference
  server's rate.
- **A busy ring makes no system calls**: 163 futex calls over a million
  messages, all from the moments the consumer caught up and went to sleep. A
  socket makes two a message whatever the load. **An idle ring makes two a
  message**, the same as the socket, and the idle rates match because both are
  bound by the bench's 1 ms sleep.
- The socketpair's 23 µs is mostly the cost of waking a sleeping reader on
  this VM (a futex wake and an inter-processor interrupt). On bare metal it
  would be lower, and so would the ring's slow path; the busy path would not
  change, since it never enters the kernel.

To reproduce:

```sh
npm run build
node bench/ring-latency/run.mjs              # 5 rounds, CPUs 0 and 1
node bench/ring-latency/run.mjs --rounds 9 --cpus 2,3
```

### Records copied or in place

`bench/ring-inplace/` answers keep-alive HTTP/1.1 requests with JSON records
of 1, 4 and 10 KB. A producer process renders each record with
`nish/json`'s `JsonWriter` into an `SpscRing`, an `Http1Connection` in the
parent answers with it, and a third process drains the socket. Three paths
are compared:

- **copied**: the producer renders into its own buffer and calls `tryPush`,
  the consumer calls `tryPop` into its own and then `write`s the body;
- **in place**: the producer `reserve`s a window, renders into it and
  `commit`s; the consumer `peek`s the record, passes the window to
  `sendBody` and `release`s it once the body is sent;
- **consumer**: the producer half of copied and the consumer half of in
  place. The producer renders into its own buffer and calls `tryPush`; the
  consumer `peek`s, `sendBody`s and `release`s. A record `tryPush` wrapped
  across the ring's end cannot be lent, so `peek` answers none for it and
  the consumer `tryPop`s it; the table counts those as wrapped records
  popped, and their bytes as copied.

The machine is a 4-core cloud VM: an Intel Xeon Processor @ 2.30 GHz, with
48 KiB of L1d and 2 MiB of L2 per core and a 260 MiB L3 shared by all four,
Linux 6.18, on 2026-11-07. The consumer runs on CPU 0, the producer on
CPU 1 and the reader on CPU 2: three of the four cores are pinned. The
consumer times each message from the request to the response being
flushed, into a 10 ns histogram after a warm-up of a tenth. Its wait for
the producer is left out. The pipeline figure is wall time over messages.

Bytes copied counts every user-space copy of a body byte that the bench can
see: the producer's `tryPush`, the consumer's `tryPop`, and what `write` or
`sendBody` puts in the connection's output. For `sendBody` that is only
what it keeps of a body the socket did not take whole (a tail); the table
gives the median over runs, a message, to two decimals, and the most
messages with a tail and the most tail bytes in any run. Not counted, in
any mode: the response head, which `respond` writes into the output; the
kernel's copy into the socket; `Http1Connection`'s compaction of its output
when it makes room; and the reader's `netRead`.

Every run checks what it delivered. The reader counts the bytes it reads,
which must equal what the consumer sent. It also parses each response head,
takes its `content-length` worth of body, and folds those bodies into an
FNV-1a sum, which must equal the sum the producer folds over every record
it renders. A run that fails either check fails the whole run. Both sums
are one byte at a time, on the producer's and the reader's cores, so they
slow the producer and the reader, which pace the pipeline. The pipeline
and p99 figures here are higher than those of a run without the check.
Every wait inside the run has a ten-second deadline: the producer's
attach, room in a full ring for each record, each request, each record,
room for each response head, each short body write, each drain of the
output, and the reader, whose deadline runs from its start and then from
the last byte it read. The wait for the reader to connect has five
seconds. The one wait without a deadline of its own is the consumer's
`waitPid` on each child after the run, bounded by the children's
deadlines and by `run.mjs`'s timeout on the whole program. A child that
exits with an error fails the run.

A message whose response head finds no room behind the last message's
tail makes the consumer drain before `respond`, inside the timed window,
and how often that happens can differ by mode. The bench counts these as
`stalls`, and `run.mjs` prints the most any run had. The counter came
after the full runs above: in the `--quick` runs at both ring sizes
(3,000 messages a run) it was 0 for every size and mode. Stalls do happen
in full runs (the first full run at the default ring stalled in place at
10 KB, message 25,298), but how often is unmeasured there, and they could
account for part of the in-place pipeline cost assigned below to the
producer half.

Each round runs every size and mode twice, in a seeded shuffled order, with
50,000 messages a run. A figure is the median over 5 rounds × 2 runs, with
the lowest and highest in brackets. A noise band, for p50, p99 and the
pipeline each, is the median over rounds of the gap between the two runs of
one mode in a round. A difference between two modes is set against the
wider of their two bands, and one inside it is no measured difference.

The ring is measured at two sizes. At the default 16 MiB it is larger than
any core's L2 and fits in the L3. At 1 MiB (`--ring-bytes 1048576`) it is
small enough to fit in one core's 2 MiB L2; the ring is touched from two
cores, and cache misses were not counted.

**16 MiB ring** (`node bench/ring-inplace/run.mjs`):

| record | mode | body (bytes) | consumer p50 (ns) | consumer p99 (ns) | pipeline (ns/msg) | bytes copied/msg | messages with a tail | wrapped records popped | noise band p50 / p99 / pipeline |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 KB | copied | 973.67 | 930 (790 to 990) | 5,255 (4,250 to 5,990) | 3,007 (2,786 to 3,558) | 2,921.01 | — | — | ±6.4% / ±23.0% / ±2.6% |
| 1 KB | in place | 973.67 | 1,050 (880 to 1,110) | 5,645 (4,400 to 6,470) | 3,185 (2,715 to 3,622) | 0.00 | 0 of 50,000 (at most 0, 0 bytes) | 0 | ±1.8% / ±8.0% / ±2.7% |
| 1 KB | consumer | 973.67 | 1,000 (970 to 1,370) | 5,880 (4,640 to 6,720) | 2,933 (2,779 to 3,092) | 973.71 | 0 of 50,000 (at most 0, 0 bytes) | 2 | ±7.7% / ±12.3% / ±5.9% |
| 4 KB | copied | 4,045.81 | 1,560 (1,330 to 1,690) | 22,635 (18,080 to 26,100) | 11,021 (10,452 to 11,466) | 12,137.43 | — | — | ±3.1% / ±7.5% / ±2.5% |
| 4 KB | in place | 4,045.81 | 1,485 (1,270 to 1,540) | 23,405 (19,170 to 25,630) | 11,438 (10,887 to 12,451) | 0.00 | 0 of 50,000 (at most 0, 0 bytes) | 0 | ±2.3% / ±8.0% / ±1.1% |
| 4 KB | consumer | 4,045.81 | 1,510 (1,360 to 1,630) | 25,450 (20,060 to 27,060) | 11,113 (10,513 to 11,426) | 4,046.78 | 0 of 50,000 (at most 0, 0 bytes) | 12 | ±9.0% / ±11.6% / ±1.9% |
| 10 KB | copied | 10,189.77 | 2,970 (2,620 to 3,300) | 31,415 (28,020 to 35,090) | 27,191 (26,036 to 27,705) | 30,569.31 | — | — | ±9.9% / ±7.0% / ±1.9% |
| 10 KB | in place | 10,189.77 | 2,500 (2,400 to 2,640) | 30,225 (29,080 to 35,470) | 28,887 (26,784 to 29,586) | 0.00 | 0 of 50,000 (at most 0, 0 bytes) | 0 | ±3.3% / ±1.8% / ±4.1% |
| 10 KB | consumer | 10,189.77 | 2,530 (2,330 to 2,750) | 29,885 (28,100 to 33,770) | 27,003 (25,869 to 28,708) | 10,195.88 | 0 of 50,000 (at most 0, 0 bytes) | 30 | ±2.2% / ±10.1% / ±1.1% |

| record | comparison | consumer p50 | consumer p99 | pipeline |
| ---: | --- | ---: | ---: | ---: |
| 1 KB | in place vs copied | +12.9% (band ±6.4%, outside) | +7.4% (band ±23.0%, inside) | +5.9% (band ±2.7%, outside) |
| 1 KB | consumer vs copied | +7.5% (band ±7.7%, inside) | +11.9% (band ±23.0%, inside) | -2.4% (band ±5.9%, inside) |
| 1 KB | consumer vs in place | -4.8% (band ±7.7%, inside) | +4.2% (band ±12.3%, inside) | -7.9% (band ±5.9%, outside) |
| 4 KB | in place vs copied | -4.8% (band ±3.1%, outside) | +3.4% (band ±8.0%, inside) | +3.8% (band ±2.5%, outside) |
| 4 KB | consumer vs copied | -3.2% (band ±9.0%, inside) | +12.4% (band ±11.6%, outside) | +0.8% (band ±2.5%, inside) |
| 4 KB | consumer vs in place | +1.7% (band ±9.0%, inside) | +8.7% (band ±11.6%, inside) | -2.8% (band ±1.9%, outside) |
| 10 KB | in place vs copied | -15.8% (band ±9.9%, outside) | -3.8% (band ±7.0%, inside) | +6.2% (band ±4.1%, outside) |
| 10 KB | consumer vs copied | -14.8% (band ±9.9%, outside) | -4.9% (band ±10.1%, inside) | -0.7% (band ±1.9%, inside) |
| 10 KB | consumer vs in place | +1.2% (band ±3.3%, inside) | -1.1% (band ±10.1%, inside) | -6.5% (band ±4.1%, outside) |

**1 MiB ring** (`node bench/ring-inplace/run.mjs --ring-bytes 1048576`, 5
rounds):

| record | mode | body (bytes) | consumer p50 (ns) | consumer p99 (ns) | pipeline (ns/msg) | bytes copied/msg | messages with a tail | wrapped records popped | noise band p50 / p99 / pipeline |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 KB | copied | 973.67 | 885 (790 to 940) | 5,345 (3,920 to 5,960) | 2,771 (2,593 to 3,375) | 2,921.01 | — | — | ±9.2% / ±20.1% / ±5.3% |
| 1 KB | in place | 973.67 | 940 (930 to 1,030) | 4,780 (3,950 to 5,780) | 2,987 (2,887 to 3,317) | 0.00 | 0 of 50,000 (at most 0, 0 bytes) | 0 | ±0.0% / ±18.4% / ±2.7% |
| 1 KB | consumer | 973.67 | 950 (930 to 1,020) | 5,550 (4,010 to 12,700) | 2,806 (2,710 to 3,207) | 974.55 | 0 of 50,000 (at most 0, 0 bytes) | 45 | ±2.1% / ±12.6% / ±3.4% |
| 4 KB | copied | 4,045.81 | 1,570 (1,430 to 1,680) | 24,460 (17,550 to 26,270) | 10,677 (10,419 to 11,417) | 12,137.43 | — | — | ±3.7% / ±13.9% / ±2.1% |
| 4 KB | in place | 4,045.81 | 1,490 (1,370 to 1,570) | 23,630 (20,970 to 26,580) | 10,713 (10,169 to 11,983) | 0.00 | 0 of 50,000 (at most 0, 0 bytes) | 0 | ±2.9% / ±6.1% / ±1.9% |
| 4 KB | consumer | 4,045.81 | 1,455 (1,360 to 1,610) | 25,415 (13,700 to 33,140) | 10,846 (10,092 to 12,003) | 4,061.43 | 0 of 50,000 (at most 0, 0 bytes) | 193 | ±13.5% / ±29.5% / ±3.1% |
| 10 KB | copied | 10,189.77 | 3,075 (2,550 to 3,210) | 31,395 (27,640 to 37,850) | 26,587 (25,150 to 27,382) | 30,569.31 | — | — | ±4.5% / ±12.9% / ±2.0% |
| 10 KB | in place | 10,189.77 | 2,235 (2,040 to 2,590) | 28,435 (26,470 to 29,620) | 26,379 (24,691 to 27,533) | 0.00 | 0 of 50,000 (at most 0, 0 bytes) | 0 | ±7.5% / ±4.6% / ±1.5% |
| 10 KB | consumer | 10,189.77 | 2,500 (2,260 to 2,720) | 30,050 (27,430 to 32,770) | 26,642 (25,435 to 27,772) | 10,288.81 | 0 of 50,000 (at most 0, 0 bytes) | 486 | ±4.8% / ±4.0% / ±2.9% |

| record | comparison | consumer p50 | consumer p99 | pipeline |
| ---: | --- | ---: | ---: | ---: |
| 1 KB | in place vs copied | +6.2% (band ±9.2%, inside) | -10.6% (band ±20.1%, inside) | +7.8% (band ±5.3%, outside) |
| 1 KB | consumer vs copied | +7.3% (band ±9.2%, inside) | +3.8% (band ±20.1%, inside) | +1.3% (band ±5.3%, inside) |
| 1 KB | consumer vs in place | +1.1% (band ±2.1%, inside) | +16.1% (band ±18.4%, inside) | -6.0% (band ±3.4%, outside) |
| 4 KB | in place vs copied | -5.1% (band ±3.7%, outside) | -3.4% (band ±13.9%, inside) | +0.3% (band ±2.1%, inside) |
| 4 KB | consumer vs copied | -7.3% (band ±13.5%, inside) | +3.9% (band ±29.5%, inside) | +1.6% (band ±3.1%, inside) |
| 4 KB | consumer vs in place | -2.3% (band ±13.5%, inside) | +7.6% (band ±29.5%, inside) | +1.2% (band ±3.1%, inside) |
| 10 KB | in place vs copied | -27.3% (band ±7.5%, outside) | -9.4% (band ±12.9%, inside) | -0.8% (band ±2.0%, inside) |
| 10 KB | consumer vs copied | -18.7% (band ±4.8%, outside) | -4.3% (band ±12.9%, inside) | +0.2% (band ±2.9%, inside) |
| 10 KB | consumer vs in place | +11.9% (band ±7.5%, outside) | +5.7% (band ±4.6%, outside) | +1.0% (band ±2.9%, inside) |

What this says, and only as far as the bands allow:

- **Which half to adopt.** The consumer half of the in-place path is worth
  adopting at 10 KB, where it cuts the consumer's median by 14.8 % (16 MiB,
  band ±9.9 %) and 18.7 % (1 MiB, band ±4.8 %) with no measured difference
  to the pipeline; at 1 and 4 KB it makes no measured difference except a
  4 KB p99 12.4 % higher at 16 MiB, just outside its ±11.6 % band and
  inside it at 1 MiB. In consumer mode not every record is lent: at 1 MiB
  and 10 KB about 1 % wrap and are popped. The producer half is not worth
  adopting at any size measured: inferred from consumer against in place,
  it is never faster over the pipeline, and is slower at every size with
  the 16 MiB ring.
- **Copies.** In place makes no user-space copy of the body, except
  partial-write tails, and these runs had none (0 bytes over 0 of 50,000
  messages in every run). Copied moves each body three times in user space
  (2,921 bytes for a 973-byte body). Consumer moves it once, `tryPush`'s
  copy, plus the wrapped records it pops: a median of 2, 12 and 30 a run
  of 50,000 at 1, 4 and 10 KB with the 16 MiB ring, and 45, 193 and 486
  with the 1 MiB ring. At 4 and 10 KB that is about sixteen times as many,
  with a ring a sixteenth the size; at 1 KB it is 22.5 times.
- **The pipeline with the 16 MiB ring** is slower in place than copied at
  every size: +5.9 % (band ±2.7 %), +3.8 % (±2.5 %) and +6.2 % (±4.1 %).
  Consumer makes no measured difference to copied at any size (-2.4 %,
  +0.8 %, -0.7 %, each inside its band), and is faster than in place at
  every size (-7.9 %, -2.8 %, -6.5 %, each outside). Consumer and in place
  differ only in the producer half, so the pipeline cost is inferred to
  belong to it; there is no producer-only mode to show it directly. The
  in-place producer differs in more than where it renders: it also skips
  `tryPush`'s copy and renders into a window `reserve` lends rather than a
  private buffer, so these runs do not say which of those is the cost.
  Respond stalls are another candidate: their frequency in the full runs
  is unmeasured.
- **The small ring and the cache explanation.** The cache explanation is
  that in place's pipeline is slower because the producer renders into ring
  memory the consumer reads from. With the 1 MiB ring, small enough to fit
  in one core's L2, the in-place pipeline makes no measured difference to
  copied at 4 KB (+0.3 %, band ±2.1 %) and 10 KB (-0.8 %, band ±2.0 %),
  where at 16 MiB it was outside its band at both. At 1 KB the gap stays:
  +7.8 % (band ±5.3 %), and consumer is still faster than in place there
  (-6.0 %, band ±3.4 %). So the cache explanation is undecided at 4 and
  10 KB (consistent with it, not shown) and not supported at 1 KB. No band
  covers the change between ring sizes itself: it is a difference of two
  differences, and the in-place pipeline's ranges at the two ring sizes
  overlap (4 KB: 10,887 to 12,451 against 10,169 to 11,983; 10 KB: 26,784
  to 29,586 against 24,691 to 27,533). At 4 KB the 16 MiB gap was only
  just outside its band (+3.8 %, band ±2.5 %). At 1 KB some cost of the
  producer half other than the cache is a possibility, not measured.
  Neither run measured cache misses.
- **The consumer's median** is faster in place than copied at 10 KB at
  both sizes (-15.8 %, band ±9.9 %; -27.3 %, band ±7.5 %). At 4 KB it is
  4.8 % and 5.1 % faster, outside bands of ±3.1 % and ±3.7 %. At 1 KB with
  the 16 MiB ring it is 12.9 % slower (band ±6.4 %); with the 1 MiB ring,
  no measured difference. Consumer against in place makes no measured
  difference to the median at any size with the 16 MiB ring; at 10 KB with
  the 1 MiB ring it is 11.9 % slower (band ±7.5 %).
- **The consumer's p99** makes no measured difference between any two
  modes, except the 4 KB consumer-against-copied figure above and, at 1 MiB
  and 10 KB, consumer against in place (+5.7 %, band ±4.6 %). A candidate
  cause there is the wrapped pops: that run pops 486 of 50,000 records,
  about 1 %, each a full 10 KB `tryPop` copy inside the timed window, and
  1 % is the p99 boundary. The pops cannot explain the 4 KB +12.4 % at
  16 MiB, which has 12.

To reproduce:

```sh
npm run build
node bench/ring-inplace/run.mjs                          # 5 rounds, 16 MiB ring, CPUs 0, 1 and 2
node bench/ring-inplace/run.mjs --ring-bytes 1048576     # the 1 MiB ring
node bench/ring-inplace/run.mjs --quick                  # 3,000 messages a run, seconds
```

## 8. The example

`examples/prefork-jobs.ts` starts five prefork workers. Worker 0 owns a table
of counters. Workers 1 to 4 each send it 10,000 jobs ("add this to counter
k") through one shared `MpscRing`, with at most 32 in flight, and get each
answer back on an `SpscRing` of their own. The supervisor creates the region
and all five rings, runs the workers, and then reads the totals out of the
region:

```text
4 workers sent 40000 jobs; the owner answered 40000
the counters sum to 200020000; 0 answers were wrong or missing
```

It takes 0.1 s of wall time, start-up of five processes included. The
example is compiled by the performance gate in both number modes, as every
example is.

## 9. Under `--sandbox`

A region is a file under `/dev/shm`, and `--sandbox`'s Landlock ruleset grants
file access only for what `main` reaches. A sandboxed program whose `main`
reaches `ffi` but neither `fs.read` nor `fs.write` therefore gets
`SHM_ACCESS` from `createRegion` and `openRegion`, a checked error. A program
that also reaches both runs as it would unsandboxed. The futex calls are not
filtered. The capability report says `ffi` and not `fs.write` because the
module calls C and the checker does not look inside C; teaching it that a
region is a file is left for when the checker learns what each C declaration
reaches.

## 10. Not done

- **Darwin's wake** (§4): `os_sync_wait_on_address` once the oldest
  supported SDK has it.
- **A dead MPSC producer** stalls the ring (§5). A supervisor makes a fresh
  ring.
- **Resizing a region.** A region's size is fixed at creation. A peer that
  shrinks the object with `ftruncate` makes a later access past the new end
  raise `SIGBUS`, which the runtime does not catch. The security record keeps
  this open (SHM-3).
- **Typed records.** Rings carry bytes. A program frames its records with
  `nish/bytes`' `getI32LE` / `setI64LE` and their kin, as the example does.
