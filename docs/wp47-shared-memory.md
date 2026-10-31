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

**What is not checked, and what is.** Who calls what is not checked. Two
producers on an `SpscRing`, or two consumers on either ring, lose or repeat
records. That is a misuse the type cannot see across processes. They never
read or write outside the region, though, because every access is a checked
`SharedRegion` access. A length a peer wrote that cannot be a record (below
0, past the capacity, past what was published) panics with "the ring is
corrupt", naming the length and the position (SHM-1 in the security record).
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
