# Shared memory between processes

[Threads](threads.md) share one address space. Processes do not: the workers
`nish/net/prefork` starts are separate programs, each with its own memory.
`nish/sync/shm` gives them memory they all see, a **named region**, and
`nish/sync/ring` builds queues in it, so one process can hand work to another
on a different core without a socket or a system call per message.

| You need | Reach for |
| --- | --- |
| a block of memory several processes read and write | [`createRegion` / `openRegion`](#a-region) |
| a counter, flag or total they all update | [the atomics on a region](#counting-across-processes) |
| a queue from one process to another | [`SpscRing`](#a-queue-spscring-and-mpscring) |
| to write or read a queued record where it lies, with no copy | [`reserve`, `commit`, `peek` and `release`](#records-in-place-reserve-commit-peek-and-release) |
| a queue from many processes to one | [`MpscRing`](#a-queue-spscring-and-mpscring) |
| to sleep until another process says there is work | [`popWait`, or `waitI32` and `wake`](#sleeping-until-there-is-work) |

The rules are in the reference,
[Shared memory between processes](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#shared-memory-between-processes-nishsyncshm-and-nishsyncring).
Both modules are native only, and a program that imports neither is
unchanged.

## A region

`createRegion(name, bytes)` makes a region of `bytes` zero bytes and maps it;
`openRegion(name)` maps one that exists, in any process of the same user;
`unlinkRegion(name)` removes the name. Each answers a `Result`:

```ts nish:ok
import { ACQUIRE, createRegion, openRegion, RELEASE, unlinkRegion } from "nish/sync/shm";

export const main = (): i32 => {
  const name = "guide-region";
  const a = createRegion(name, 4096).expect("create");
  const b = openRegion(name).expect("open"); // another process would do this
  a.storeI32(0, 42, RELEASE);
  console.log(`${b.loadI32(0, ACQUIRE)}`); // 42
  unlinkRegion(name).expect("unlink");
  b.close().expect("close");
  a.close().expect("close");
  return 0;
};
```

- **Make the region before you start the workers.** A Nish program has no
  `fork`, so a child does not inherit a mapping; it opens the region by name.
  The usual shape is a supervisor that calls `createRegion`, then
  `preforkWith`, and `unlinkRegion` when the workers have exited.
- **The name outlives the processes.** It stays (in `/dev/shm` on Linux) until
  `unlinkRegion`, even if every process has exited, so a program killed
  before it unlinks leaves it behind. Unlink a stale one before creating, as
  [`examples/prefork-jobs.ts`](https://github.com/amritk/nish/blob/main/examples/prefork-jobs.ts) does. The
  mapping itself goes away with `close()` or when the process exits.
- **A name somebody else made is refused.** `createRegion` fails with
  `SHM_EXISTS` when the name exists, whoever made it; `openRegion` fails with
  `SHM_ACCESS` when the region is not this user's or is open to anyone else.
  A name is 1 to 30 letters, digits, `.`, `_` or `-`, and a size is 1 byte to
  1 GiB.
- **A region belongs to the thread that mapped it.** In a program that also
  uses [threads](threads.md), another thread opens the name itself.

## Counting across processes

A region is read and written through **slots** at byte offsets: `loadI32`,
`storeI32`, `addI32`, `exchangeI32` and `compareExchangeI32`, and the same
five for `I64`. Each is one atomic access, with the ordering you name:
`RELAXED`, `ACQUIRE`, `RELEASE`, `ACQ_REL` or `SEQ_CST`.

```ts nish:ok
import { ACQ_REL, createRegion, SEQ_CST, unlinkRegion } from "nish/sync/shm";

export const main = (): i32 => {
  const region = createRegion("guide-counter", 64).expect("create");
  for (let i = 0; i < 1000; i++) {
    region.addI64(8, toI64(1), ACQ_REL); // every worker can do this at once
  }
  // Set a flag only if nobody has: the answer is the value found.
  const was = region.compareExchangeI32(0, 0, 1, SEQ_CST);
  console.log(`${region.loadI64(8, SEQ_CST)} ${was === 0}`); // 1000 true
  unlinkRegion("guide-counter").expect("unlink");
  return 0;
};
```

- **Offsets are checked, as array indexes are.** A slot must lie inside the
  region and at a multiple of its width (4 for `I32`, 8 for `I64`); anything
  else stops the program with a message naming the offset, such as
  `nish/sync/shm: slot offset 4 is not a multiple of 8, the slot's width`.
  Lay a region out with constants, a 64-bit slot at a multiple of 8.
- **Bytes go through `read` and `write`**, which copy a window between the
  region and a `u8[]`, checked against both. A copy is not atomic: order it
  with an atomic store after it and an atomic load before reading it, which
  is what the rings below do for you.
- **An ordering must suit the access.** A load takes `RELAXED`, `ACQUIRE` or
  `SEQ_CST`, a store `RELAXED`, `RELEASE` or `SEQ_CST`; asking a load for
  `RELEASE` stops the program.

## A queue: `SpscRing` and `MpscRing`

A ring is a bounded queue of byte records inside a region. `SpscRing` has one
producer and one consumer; `MpscRing` takes any number of producers and one
consumer, in slots of a fixed size. The process that makes the region writes
the ring's header with `initSpscRing` or `initMpscRing`; every other process
finds it with `attachSpscRing` or `attachMpscRing`:

```ts nish:ok
import { createRegion, unlinkRegion } from "nish/sync/shm";
import { attachSpscRing, initSpscRing, RING_EMPTY, spscRingBytes } from "nish/sync/ring";

export const main = (): i32 => {
  const region = createRegion("guide-ring", spscRingBytes(4096)).expect("create");
  const producer = initSpscRing(region, 0, 4096, true);
  const consumer = attachSpscRing(region, 0).expect("attach"); // in the other process
  const job: u8[] = [7, 8, 9];
  if (!producer.tryPush(job, 0, job.length)) {
    console.log("full");
  }
  const buf: u8[] = new Array<u8>(64);
  const n = consumer.tryPop(buf, 0);
  console.log(n === RING_EMPTY ? "empty" : `${n} bytes, the first ${buf[0]}`); // 3 bytes, the first 7
  unlinkRegion("guide-ring").expect("unlink");
  return 0;
};
```

- **Neither blocks.** `tryPush` answers `false` when the ring is full;
  `tryPop` answers the record's length, `RING_EMPTY`, or `RING_TOO_SMALL` when
  the buffer cannot hold the next record, which stays queued. `popBatch` takes
  every record that is ready at once.
- **Size it.** `spscRingBytes(capacity)` and `mpscRingBytes(slots, slotBytes)`
  say how many bytes a ring takes; a capacity or a slot count is a power of
  two. Several rings can share a region at different offsets, each a
  multiple of 64.
- **Keep to the roles.** Two consumers, or two producers on an `SpscRing`,
  lose or repeat records. They never read outside the region, and a ring a
  broken process scribbled on stops the program with `the ring is corrupt`
  rather than handing back garbage lengths.
- **Frame records yourself.** A record is bytes; `getI32LE`, `setI64LE` and
  their kin in [`nish/bytes`](standard-library.md) read and write fields.

The repository's
[`examples/prefork-jobs.ts`](https://github.com/amritk/nish/blob/main/examples/prefork-jobs.ts) puts it
together: four prefork workers send jobs to a fifth on one `MpscRing`, and
each gets its answers back on an `SpscRing` of its own.

## Records in place: `reserve`, `commit`, `peek` and `release`

`tryPush` and `tryPop` copy each record once. An `SpscRing` also lends the
record's bytes where they lie in the ring, as `lend` does a region's.
`reserve(n)` answers a `u8[]` window of `n` bytes for the producer to write,
and `commit(len)` publishes its first `len`; `peek()` answers the next record
as a `readonly u8[]`, and `release()` frees it:

```ts nish:ok
import { createRegion, unlinkRegion } from "nish/sync/shm";
import { attachSpscRing, initSpscRing, spscRingBytes } from "nish/sync/ring";

export const main = (): i32 => {
  const region = createRegion("guide-inplace", spscRingBytes(4096)).expect("create");
  const producer = initSpscRing(region, 0, 4096, false);
  const consumer = attachSpscRing(region, 0).expect("attach"); // in the other process
  const w: u8[] = producer.reserve(64); // empty when there is no room now
  if (w.length > 0) {
    for (let i = 0; i < 3; i++) {
      w[i] = toU8(7 + i); // writes the ring, no copy
    }
    producer.commit(3); // publishes 3 of the 64 bytes
  }
  const r: readonly u8[] = consumer.peek();
  if (r.length > 0) {
    console.log(`${r.length} bytes, the first ${r[0]}`); // 3 bytes, the first 7
    consumer.release();
  }
  unlinkRegion("guide-inplace").expect("unlink");
  return 0;
};
```

- **Neither blocks.** With no room for `n` bytes now, `reserve` answers an
  empty window and lends nothing; try again later, as with `tryPush`. `n` is
  from 1 to half the ring less 4, so an empty ring always has room for one.
  That makes a ring of 8 bytes unable to reserve at all (`reserve` stops the
  program with `an SPSC ring of 8 bytes cannot reserve`), and a ring of 16
  allows 4 bytes; use `tryPush` there, or a bigger ring.
- **`abandon()` publishes nothing.** It ends a reservation you do not want.
- **An empty `peek` may still have a record.** Besides an empty ring, it
  answers empty for a record of length 0 and for one `tryPush` wrote across
  the end of the ring, which are not one run of bytes. `tryPop` takes those,
  so a consumer that peeks falls back to it:
  `if (r.length === 0) { n = consumer.tryPop(buf, 0) }`.
- **After `commit`, `abandon` or `release` the window is empty**, and the
  next index stops the program, as after `giveBack`. Each end keeps one
  window and points it at the next record, so the busy path allocates
  nothing; do not keep a window past the call that ends it. A reference you
  do keep is re-pointed by the next `reserve` or `peek`, and then aliases that
  record: writes through it land in it, and reads see it.
- **The reserved bytes are not zeroed.** They hold whatever the ring last held
  there; `commit` only what you wrote.
- **One at a time.** A second `reserve` before `commit` or `abandon`, a
  `tryPush` while a reservation is open, or a `peek`, `tryPop`, `popBatch` or
  `popWait` while a record is lent stops the program and names the call (for
  `popWait`, `tryPop`, which it calls). So does `commit` of more bytes than
  were reserved. A `push` onto the window is not noticed at once: the program
  stops later, at `commit` or `abandon` (or `release`, for a peeked window),
  with `window of length 9 is no longer the region's bytes: a push moved it`.
- **A peeked record is not a snapshot.** Its bytes are the ring's, so a
  broken producer can change them while you read. Check a field once, or
  copy the record into a buffer of your own first (or take it with `tryPop`) when
  you must decide on bytes you do not trust.
- **The ring stays one ring.** A reservation that would cross the end of the
  ring starts at the beginning, behind a marker every pop steps over, so
  `tryPush`, `reserve`, `tryPop`, `popBatch`, `popWait` and `peek` mix freely
  on one ring. Both ends must be built from a Nish that has `reserve`: an
  older consumer stops at the marker with `the ring is corrupt`.
- **A peek consumer on a doorbell ring polls.** `popWait` takes records, not
  windows, and there is no wait call for `peek` yet: loop on `peek` (and
  `tryPop` when it answers empty) instead.

## Sleeping until there is work

A ring made with its last argument `true` has a **doorbell**. `popWait(buf,
off, timeoutMs)` spins briefly, then sleeps until a push or the timeout, and
a push rings the doorbell only when the consumer is asleep, so a busy ring
makes no system call at all. On Linux, that is. Elsewhere `popWait` answers
`SHM_UNSUPPORTED`, so a portable consumer falls back to polling:

```ts nish:ok
import { createRegion, SHM_UNSUPPORTED, unlinkRegion } from "nish/sync/shm";
import { initMpscRing, mpscRingBytes, MpscRing, RING_EMPTY } from "nish/sync/ring";

const take = (ring: MpscRing, buf: u8[]): i32 => {
  const n = ring.popWait(buf, 0, 100);
  return n === SHM_UNSUPPORTED ? ring.tryPop(buf, 0) : n;
};

export const main = (): i32 => {
  const region = createRegion("guide-bell", mpscRingBytes(8, 16)).expect("create");
  const ring = initMpscRing(region, 0, 8, 16, true);
  const buf: u8[] = new Array<u8>(16);
  console.log(`${take(ring, buf) === RING_EMPTY}`); // true, after 100 ms
  unlinkRegion("guide-bell").expect("unlink");
  return 0;
};
```

Without a ring, `waitI32(at, expected, timeoutMs)` sleeps while a 32-bit slot
holds `expected`, and `wake(at, count)` wakes the processes sleeping on it.
Both answer `SHM_UNSUPPORTED` off Linux too.

## What it costs and what it needs

- **Speed.** Between two cores, a record and its answer take under a
  microsecond each way round on a busy ring, against tens of microseconds
  through a socket pair, and a streaming ring moves millions of records a
  second. The repository's `bench/ring-latency/` measures both.
- **Capabilities.** The modules call C, so a program that imports them is
  reported with `ffi` (and `clock`, for `popWait`), and `--deny ffi` refuses
  it. Under [`--sandbox`](sandbox.md) a region is a file in `/dev/shm`, so
  the program needs `fs.read` and `fs.write` as well, or `createRegion` fails
  with `SHM_ACCESS`.
- **Native only.** [Back to TypeScript](to-typescript.md) (`--emit-ts`)
  refuses a program that imports them: Node shares memory between threads of
  one process, not between processes.
