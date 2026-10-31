# Security record: shared memory between processes

The record of `nish/sync/shm` and `nish/sync/ring`: the named regions a
program maps, the checked slots, windows and atomics it reads them through,
and the rings it builds on them. A region is a file in a world-writable
directory (`/dev/shm` on Linux), and every byte in it can be written at any
moment by another process, so both the name and the contents are
attacker-facing. It says what is refused, with which code or panic, and the
test that pins each answer. The design is
[`wp47-shared-memory.md`](../wp47-shared-memory.md). It was written on top of
`main` at `ce8f92c`, in the change that adds the three files, and names
functions rather than lines, so it has no `file:line` anchors to move.

**Result.** No byte another process writes can make an access read or write
outside the mapping: every slot, window and ring position is checked against
the size the mapping was made with, in the runtime, not against anything
stored in the region. A name another user planted is refused, never adopted.
A corrupt ring is a panic that names the record. What remains is the
mapping's own size: a same-user peer that shrinks the object makes a later
access a `SIGBUS` (SHM-3, open). Three findings: two fixed, one open.

## Scope

| File | What |
| --- | --- |
| `runtime/runtime-shm.c` | the region table and its handles (`region_of`, `region_checked`, `slot_take`, `adopt`); the checks (`slot_at`, `window`, `order_check`); `nishshm_create`, `nishshm_open`, `nishshm_unlink`, `nishshm_close`, `name_ok`, `path_of`; the atomics, `nishshm_read`, `nishshm_write`, `nishshm_wait_i32`, `nishshm_wake` |
| `std/sync/shm.ts` | `createRegion`, `openRegion`, `unlinkRegion`, `SharedRegion` and its accessors |
| `std/sync/ring.ts` | `SpscRing`, `MpscRing`: `tryPush`, `tryPop`, `popBatch`, `popWait`, `lengthAt`; `initSpscRing`, `attachSpscRing`, `initMpscRing`, `attachMpscRing`, `ringCheckPlace` |

Out of scope: `examples/prefork-jobs.ts` and `bench/ring-latency/`, which are
programs built on the modules, not part of them.

## Threat model

**Who is trusted.** The program's own code, and the person who runs it.

**Who is the adversary.** Two of them.

1. **Another user on the host.** It can create files in `/dev/shm` before
   the program does, under any name, as a regular file, a symbolic link, a
   FIFO or (where `fs.protected_hardlinks` is 0) a hard link to a file of
   ours in the same directory. It cannot open a 0600 region of ours. Its aim
   is to make the program map an object it controls, or one the program did
   not name.
2. **A peer process of the same user that is broken or compromised**: a
   worker that a bug or an exploit has taken over. It can write any byte of
   any region it has mapped, at any time, including the ring's header,
   cursors and lengths, and it can `ftruncate` or unlink the object. It
   already has the user's privileges, so the aim is not to read the user's
   files through the region. It is to turn the bytes it writes into memory
   corruption, an out-of-bounds read or an unchecked crash in the process
   that reads them.

**What is not claimed.** A region carries no authentication: a same-user
peer can forge any record, and a program that needs to know which worker
sent one has to say so in the record. A dead MPSC producer that claimed a
slot and never filled it stalls the ring (wp47 §5); that is liveness, not
memory safety, and a supervisor recovers by making a fresh ring.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| SHM-1 | Low | `std/sync/ring.ts` (`SpscRing.lengthAt`) | A record length a peer wrote near 2^31 overflowed the rounding `(len + 3) & ~3` before the check against the ring's capacity, so the consumer panicked on the integer overflow, not with the ring's own message. No access left the region: the overflow panic is checked arithmetic. | **Fixed** in this change: the length is checked against `capacity - 4` first. Before: the child panicked on the overflow. After: "a record of length 2147483645 at position 0: the ring is corrupt". |
| SHM-2 | Low | `runtime/runtime-shm.c` (`nishshm_open`) | `openRegion` checked the object's owner and mode, not what it is. On a host with `fs.protected_hardlinks` set to 0, another user can hard-link one of our 0600 regions under a name we will later open, and we would map the wrong region with no error; a FIFO of ours at the name was refused only by its size. | **Fixed** in this change: on Linux, an object that is not a regular file or has more than one link is `SHM_ACCESS`. Before: the second link opened and mapped the first region. After: "a region with a second link is SHM_ACCESS", "a FIFO is SHM_ACCESS". |
| SHM-3 | Low | `runtime/runtime-shm.c` (`adopt`) | A region's size is read once, when it is mapped. A same-user peer that shrinks the object with `ftruncate` leaves the mapping in place, and an access past the new end raises `SIGBUS`, which the runtime does not catch, so the process dies by the signal rather than by a checked panic. | **Open.** Only a peer that already has the user's privileges can do it, and the process stops rather than reading or writing past the object. File seals (`F_SEAL_SHRINK`) would close it but apply only to `memfd` objects, which have no name a later process can open; a `SIGBUS` handler that turns the fault into a panic is the alternative. |

## Properties verified

Each property below is pinned by a test that fails if it stops holding. The
tests are the checks of `tests/link/sync_shm` and `tests/link/sync_ring`, run
by "link/sync_shm: exits with 0 and stdout matches expected.out" and
"link/sync_ring: exits with 0 and stdout matches expected.out". The panics
are checked in a child each: "${what}: the child exits 1" and "${what}: and
says why", where `${what}` is the case named below.

- **A name is never adopted.** `createRegion` opens with `O_CREAT | O_EXCL |
  O_NOFOLLOW | O_CLOEXEC` and mode 0600, so a name that exists, whoever made
  it, is `SHM_EXISTS`: "a name that exists is SHM_EXISTS". A planted name is
  therefore a denial of service, never a takeover. A name is 1 to 30 of `A-Z
  a-z 0-9 . _ -`, not starting with `.` (`name_ok`), so it cannot leave the
  directory: "a name with a slash is SHM_INVALID".
- **`openRegion` maps only one regular file of ours, private to us.** Another
  user's, or one with a group or other mode bit, is `SHM_ACCESS` ("a region
  others may read is SHM_ACCESS"); a symbolic link is not followed ("a
  symbolic link is not followed (ELOOP)"); a second link or a FIFO is
  `SHM_ACCESS` (SHM-2); an empty object, or one over 1 GiB, is
  `SHM_INVALID` ("an empty object is SHM_INVALID").
- **Every slot is checked against the mapping**, in `slot_at`, before the
  atomic: past the end ("past-end", "slot offset 64 is outside the region of
  64 bytes"), below 0 ("negative"), and not a multiple of the slot's width
  ("misaligned", "slot offset 4 is not a multiple of 8, the slot's width"), so
  no atomic is ever misaligned or out of range. The size compared against is
  the one stored in the thread's table at `adopt`, never one read from the
  region.
- **An ordering the access cannot take is a panic, not a weaker access**:
  "load-release" ("ordering 3 cannot order a load"), "store-acquire"
  ("ordering 2 cannot order a store"), "no-order" ("ordering 7 is not an
  ordering").
- **A byte window is checked on both sides** (`window`), against the region
  ("window", "byte window at 63 is outside the region of 64 bytes") and
  against the program's buffer ("buffer", "buffer window at 1 is outside the
  buffer of 1 bytes"), and copied once, so a writer can tear it but cannot
  move the bounds after the check: "a byte window round-trips".
- **A closed handle is a panic, never a stale mapping**: a handle carries its
  slot's generation, bumped by every close ("closed", "names no open
  region"). Closing one mapping of a name leaves the others: "closing the
  second mapping", "leaves the first".
- **A ring is placed inside its region, and its bytes are distrusted.**
  `ringCheckPlace` refuses a ring whose base is not a multiple of 64
  ("misplaced") or that does not fit ("too-big"); a push longer than the ring
  or slot panics ("long-record", "long-slot"); a length a peer wrote that the
  ring cannot hold panics as corrupt (SHM-1, "corrupt"). The ring's capacity
  is read once, at attach, and checked there ("attaching an SPSC ring as MPSC
  is refused", "as is attaching where no ring was made", "attaching an MPSC
  ring as SPSC is refused"); every later read and write goes through the
  region's checked accessors, so a cursor a peer moves can deliver wrong
  bytes but cannot reach outside the region.
- **A program that does not import the modules is unchanged**, and one that
  does reaches `ffi` and so is refused under `--deny ffi`:
  `link/${name}: rejected with "${needle}"` for `sync_shm_deny_ffi`.

## Notes

**`--sandbox`.** A region is a file in `/dev/shm`, so Landlock refuses it
unless `main` also reaches `fs.read` and `fs.write`; `createRegion` then
answers `SHM_ACCESS`. The capability report for a program that maps a region
reads `ffi (not deterministic)`.

**Where the futex word lives.** `waitI32` and `wake` use shared (not
`FUTEX_PRIVATE`) futexes on a checked, aligned i32 slot. A peer that wakes a
sleeper spuriously, or never wakes it, can only make it re-check or wait out
its timeout: `popWait` loops on the ring's own state, not on the wake.
