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
access a `SIGBUS` (SHM-3, open). A window, a `u8[]` lent over the region's
bytes, is emptied by `giveBack` and by `close`, so no index through it
outlives the mapping (SHM-4). Six findings: four fixed, one open, one
decided.

## Scope

| File | What |
| --- | --- |
| `runtime/runtime-shm.c` | the region table and its handles (`region_of`, `region_checked`, `slot_take`, `adopt`); the checks (`slot_at`, `window`, `order_check`); `nishshm_create`, `nishshm_open`, `nishshm_unlink`, `nishshm_close`, `name_ok`, `path_of`; the atomics, `nishshm_read`, `nishshm_write`, `nishshm_wait_i32`, `nishshm_wake`; the windows, `window_of`, `nishshm_lend`, `nishshm_give_back` and the emptying in `nishshm_close` |
| `std/sync/shm.ts` | `createRegion`, `openRegion`, `unlinkRegion`, `SharedRegion` and its accessors, `lend` and `giveBack` |
| `src/shm-window.ts`, `src/emit-shm-window.ts` | the compiler-known `shmLend` / `shmGiveBack`, whose bodies the compiler writes as the runtime calls, and their facts in `src/attributes.ts` (`markShmWindow`) |
| `std/sync/ring.ts` | `SpscRing`, `MpscRing`: `tryPush`, `tryPop`, `popBatch`, `popWait`, `lengthAt`; `SpscRing`'s in-place calls `reserve`, `commit`, `abandon`, `peek`, `release` and their skip marker; `initSpscRing`, `attachSpscRing`, `initMpscRing`, `attachMpscRing`, `ringCheckPlace` |

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
| SHM-4 | Medium | `runtime/runtime-shm.c` (`nishshm_close`, `nishshm_give_back`) | `lend` answers a `u8[]` whose data pointer is inside the mapping, and the program may keep the array after it gives it back or closes the region. Left as it was, an index through it after `close` reads or writes an unmapped page, or, once a later `createRegion` or `malloc` reuses the address, someone else's memory: a use after free that no bounds check sees, since the length still says the bytes are there. | **Fixed before landing.** Every window is recorded on its mapping; `giveBack` empties it (length and capacity 0, data NULL) and `close` empties every window still lent over the region's bytes before the `munmap` (one a push moved is the program's array and is left alone), so the next index is the ordinary `index out of range: 0 >= 0` panic. The header itself is never freed (SHM-6), so emptying it is always a write to memory the runtime owns. Before (with the emptying taken out of `nishshm_close`): the "closed" child read the unmapped page and died by `SIGSEGV`. After: "closed: the child exits 1", "closed: and says why"; "given-back: the child exits 1", "given-back: and says why". The compiler forgets the window's length at both calls (`markShmWindow`, `resizesArray`), so an index proof from a loop bound does not cross them: "loop-given-back" and "loop-closed" panic at `index out of range: 2 >= 0`, and with `resizesArray` left false they ran on through the emptied header. |
| SHM-5 | Low | `runtime/runtime-shm.c` (`window_of`, `nishshm_lend`, `nishshm_give_back`) | `giveBack(window)` and `lend(at, len, reuse)` are handed a `u8[]` the program chose. Taken on trust, an array the region never lent would be read as a window record (its bytes past the header taken for the record's fields), and a `reuse` still lent would move a window the program is using; an array a `push` moved off the region would be emptied as if it were the region's, losing the program's own bytes. | **Fixed before landing.** A header is found by walking the mapping's own list and comparing pointers, so an array the region did not lend is never read as a record. `giveBack` panics for one not lent or already given back ("twice"), for one another region lent, and for one whose data or length moved ("pushed", `a push moved it`); `reuse` panics unless it is this region's and given back ("reuse-lent"). These checks were written with the calls, so there is no before run; each case is pinned: "twice: the child exits 1", "pushed: the child exits 1", "reuse-lent: the child exits 1", each with "and says why". |
| SHM-6 | Low | `runtime/runtime-shm.c` (`nishshm_lend`) | Each `lend` without `reuse` mallocs a 48-byte header that is never freed, because the program may hold the array past any `giveBack` or `close`, and freeing it would turn SHM-4 back into a use after free of the header. A program that lends in a loop without `reuse` grows without bound, and slows down with it: `giveBack` and a `reuse` lend walk the region's whole window list, so each costs O(windows ever lent on the region). | **Decided.** The leak is the program's own and bounded by its own calls; no peer can cause it. The reuse rule (LANGUAGE.md, "The reuse rule"; the guide's "Pass the window you gave back") is the remedy for both: a reused header takes no memory and adds no entry to the list: "a window given back lends again", "in the same header". |
| SHM-7 | Low | `std/sync/ring.ts` (`SpscRing.lengthAt`, `reserve`, `peek`) | `reserve` writes a skip marker (length -1) where a record would cross the end of the ring, and every pop path reads it as "the record starts at the next lap". A peer can write a marker anywhere: taken on trust, a marker with no record after it, or a marker at the start of a lap, would send the consumer a whole lap ahead, past what was published, and a second marker would chain the jump. | **Fixed before landing.** `lengthAt` steps over at most one marker, and checks the record it lands on as any other: a negative length (a second marker), one past `capacity - 4`, or one past the published tail panics as corrupt, naming the length and the position it landed on. `peek` lends only a record that lies in one run inside the ring's data (`len <= capacity - from`), and `lend` checks the range against the region again. These checks were written with the calls, so there is no before run; pinned by "lone-marker: the child exits 1", "lone-marker: and says why" ("a record of length -1 at position 64: the ring is corrupt"). |
| SHM-8 | Low | `std/sync/ring.ts` (`SpscRing.peek`) | `peek` lends the record's bytes where they lie, so a broken producer can change them while the consumer reads: a consumer that checks a field of a peeked record and later reads it again can see two values (a double fetch), where `tryPop`'s copy is a snapshot. A producer that keeps a `commit`ted window does not have this power, since `commit` empties it; only a peer writing the region directly does. | **Decided.** The bytes never leave the region and the window's length is fixed when it is lent, so the worst outcome is wrong bytes, which a same-user peer can forge through `tryPush` anyway. A consumer that must decide once on untrusted bytes copies them first, out of the window into its own buffer or with `tryPop`; the guide says so ("A peeked record is not a snapshot"). |

## Properties verified

Each property below is pinned by a test that fails if it stops holding. The
tests are the checks of `tests/link/sync_shm`, `tests/link/sync_ring` and
`tests/link/sync_ring_inplace`, run by "link/sync_shm: exits with 0 and
stdout matches expected.out", "link/sync_ring: exits with 0 and stdout
matches expected.out" and "link/sync_ring_inplace: exits with 0 and stdout
matches expected.out". The panics
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
- **A window is checked when it is lent and holds its bounds itself.**
  `lend` checks `[at, at + len)` against the mapping as `read`'s window is
  ("outside", "byte window at 60 is outside the region of 64 bytes"), and the
  window's length is in the program's own header, not in the region, so a
  peer that writes the bytes can change what an index reads but not how far
  it reaches. The bytes are not atomic and are as untrusted as `read`'s copy.
  The compiler marks both calls (and `close`) as possibly changing any
  array's length, so no length the bounds proof knew survives them
  (`tests/link/sync_shm_window/expected.ir` pins the calls). These run in
  `tests/link/sync_shm_window`, "link/sync_shm_window: exits with 0 and stdout
  matches expected.out", with the panics in a child each as above. Not
  exercised by a test: the `malloc` failure in `nishshm_lend`, a panic.
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
- **A ring's windows are the ring's bytes, one at a time, and empty after.**
  `reserve` lends only a run inside the ring's data that the consumer has
  freed, `peek` only a published record that lies in one run (SHM-7), and
  each end keeps one window header (SHM-6). A second reservation
  ("reserve-twice"), `tryPush` during one ("push-reserved"), `commit` or
  `abandon` without one ("commit-none", "abandon-none"), `commit` past it
  ("commit-long"), a reservation outside 1 to half the ring less 4
  ("reserve-none", "reserve-long"), and `peek`, `tryPop` or `popBatch` while a
  record is lent ("peek-twice", "pop-peeked", "batch-peeked") each panic, as
  does `release` with nothing lent ("release-none") and a `commit` of a
  window a `push` moved ("pushed", SHM-5). `commit`, `abandon` and `release`
  empty the window, and an index after one inside a loop bounded by the
  window's length panics at `index out of range: 2 >= 0` ("loop-commit",
  "loop-release"), as after `giveBack` (SHM-4).
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
