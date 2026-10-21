# WP46: Memory for programs that do not exit — regions

**Status: proposed.** Nothing here is built. The anchors below are at
`c8a00d6`. [LANGUAGE.md](LANGUAGE.md) stays normative; the API in this note is
a proposal and is not compiled by `npm test`.

Issue #482 asks what a long-running server does with state whose size is not
known at start-up. WP34's relay does not need an answer: every cap it has is a
compile-time number, so its state lives in pools sized at start-up (N9 in
[wp34-hosting-cs.md](wp34-hosting-cs.md)). A game server does need one. Its
sessions come and go, and each one holds what its player did. The arena never
frees an object, so such a server grows until it is killed.

This note weighs three ways out. It measures each against today's arena, and
recommends one: **regions**, a handle to an arena of its own that the program
frees.

## 1. The leak, measured

`bench/wp46-memory/sessions.ts` is the server this note is about. One
keep-alive `Http1Connection` is fed `GET /s/<id>` requests in memory. A cache
holds at most `live` sessions and evicts the oldest; each session holds a
payload of 16 to 255 bytes. The client asks for ten times as many ids as the
cache holds, so about nine requests in ten make a session. Every 250,000
requests the program prints how many sessions it has made and holds,
`Arena.mark()`, `Arena.used()`, and its anonymous resident memory from
`/proc/<pid>/statm`.

```sh
npm run build
build/nish bench/wp46-memory/sessions.ts --link build/wp46/sessions
build/wp46/sessions 2000000 1000 250000
```

| requests | sessions made | held | `Arena.mark()` − first | anonymous resident |
| ---: | ---: | ---: | ---: | ---: |
| 250,000 | 225,247 | 1,000 | 0 | 42.5 MB |
| 500,000 | 450,427 | 1,000 | 42.2 MB | 84.7 MB |
| 1,000,000 | 900,646 | 1,000 | 126.5 MB | 169.1 MB |
| 1,500,000 | 1,350,872 | 1,000 | 210.8 MB | 253.4 MB |
| 2,000,000 | 1,801,019 | 1,000 | 295.2 MB | 337.8 MB |

The cache holds a thousand sessions throughout, and the program grows by
187 bytes for every session it has ever made. That is a session, its payload
and the `Map` entry, none of which is freed when the cache lets it go. The
same run with 10,000 live sessions grows at the same rate: the growth follows
sessions made, not sessions held. `Arena.used()` is no measure of this. It is
the offset in the current 64 KiB chunk, and wobbles between 9,872 and 59,736.
The mark's movement is the figure.

`using a = arena()` cannot help, because a session outlives the request that
made it. Storing one into the cache from inside such a block is refused:
`` `Cache.put` is called inside the `using arena()` block ... and stores an
allocation into memory `` (NL2424).

## 2. The three options

Each option is written below as the toy cache and as the relay's session
code, in the API it would add. The cache is the one in §1:

```ts
class Session {
  id: i64 = 0
  hits: i32 = 0
  payload: u8[]
  constructor(id: i64, size: i32) {
    this.id = id
    this.payload = new Array<u8>(size)
  }
}
```

### 2.1 Regions

**Semantics.** A region is an arena of its own, reached through a handle.
`nish:region` exports:

| Export | Meaning |
| --- | --- |
| `Region<T>` | an opaque handle to a region whose root is a `T` (a class) |
| `region(f)`, `regionWith(arg, f)` | a new region, with `f()` (or `f(arg)`) run while it is the thread's arena; what `f` answers is the root |
| `enter(r, f)`, `enterWith(r, arg, f)` | `f(root)` (or `f(root, arg)`) run while `r` is the thread's arena; answers what `f` answers |
| `free(r)` | gives the region's chunks back to `malloc`; `r` and every copy of it are dead |

`f` is an arrow or a named function. Like `expose`'s, an arrow captures
nothing (NL2335), so the ways in are the root, `arg` and module state, and the
rules below follow each of them.

```ts
import { Region, enterWith, free, regionWith } from "nish:region"

const open = (id: i64): Session => new Session(id, payloadSize(id))

/** Copies the payload into the connection's buffer: only numbers leave. */
const serve = (s: Session, out: u8[]): i32 => {
  s.hits = s.hits + 1
  for (let k: i32 = 0; k < s.payload.length && k < out.length; k++) {
    out[k] = s.payload[k]
  }
  return s.payload.length
}

class Cache {
  regions: Map<i64, Region<Session>>
  order: i64[]
  head: i32 = 0
  held: i32 = 0
  constructor(live: i32) {
    this.regions = new Map<i64, Region<Session>>()
    this.order = new Array<i64>(live)
  }
  get(id: i64, out: u8[]): i32 {
    const hit = this.regions.get(id)
    if (hit !== undefined) {
      return enterWith(hit, out, serve)
    }
    if (this.held === this.order.length) {
      // full: the oldest goes; `order` holds ids only once `held` says so,
      // so a fresh table's zeroes never name a session
      const old: i64 = this.order[this.head]
      const gone = this.regions.get(old)
      if (gone !== undefined) {
        free(gone)
        this.regions.delete(old)
      }
    } else {
      this.held = this.held + 1
    }
    const r = regionWith(id, open)
    this.regions.set(id, r)
    this.order[this.head] = id
    this.head = (this.head + 1) % this.order.length
    return enterWith(r, out, serve)
  }
}
```

`Map.get` answers `Region<Session> | undefined`, and the `!== undefined`
narrows it before `enterWith` and `free` take it.

The relay would keep a region per slot for what a game hangs off a session
(`examples/relay/relay.ts`, `hello` at :701 and `release` at :551, which
`close` at :584 reaches only past its `FREE`/`CLOSING` guard). The relay has
no such field today: the sketch adds two, a handle and a flag, because a slot
that never got past `hello` has no region to free:

```ts
// new fields, sized like the relay's other per-slot arrays
games: Region<Game>[]
hasGame: boolean[]

// hello(), once the grant verifies; `g` is the relay's one reused
// RelayGrant, outer memory, so `gameFromGrant` keeps its numbers and copies
// the host byte by byte into a u8[] it allocates (keeping `g.host` or
// `g.reason` itself is NL2557)
this.games[slot] = regionWith(g, gameFromGrant)
this.hasGame[slot] = true

// release()
if (this.hasGame[slot]) {
  free(this.games[slot])
  this.hasGame[slot] = false
}
```

**The handle is a number.** `Region<T>` lowers to an `i64`: a 24-bit slot and
the slot's 40-bit generation. The slots sit in one process-wide table, made
lazily a page at a time, and each records the thread that made it, its
generation and an entered flag. `enter` panics unless all three agree:

- the slot's thread is the caller's, so a handle that reached another thread
  (through an integer, say) is refused there;
- the generation matches, so a copy of a freed handle is stale, because
  `free` bumps it;
- the slot is not already entered, so `enter(r, …)` inside `r`'s own `f`,
  directly or through a nested `enter` of another region, panics rather than
  swapping the region's arena with itself.

Generations start at 1, so the handle 0, the value a fresh `Region<T>[]`
holds, is never issued. `enter`, `enterWith` and `free` all panic on a zero
handle, a stale one, or one from another thread, and `free` of an entered
region panics as well, so freeing twice is a panic and never a double free of
the chunks.

A slot whose generation would wrap is retired rather than reused. Taking or
giving back a slot takes the table's lock, once per `region` and once per
`free`; `enter` only loads and compares. That check, rather than a move-only
type, is what lets a handle sit in a `Map`, an array or another region's
object. The checker then has nothing to prove about the handle, only about
what `f` does and where the handle travels. The 24-bit slot caps a process at
16,777,216 live regions; `region` past that panics. An allocation that
`malloc` refuses stays the `oom` exit it is today.

**Checker rules.** Inside `f` the region is the arena, and the rule is the
`using a = arena()` block's with one change: memory reachable from the root
is inside, not outside. The rule follows two kinds of value, region memory (the
root and whatever `f` allocates) and outer memory (`arg`, module state, what a
callee answers from outside).

| Route | Code |
| --- | --- |
| region memory stored into outer memory, a field, an element or a module-level binding; a number, a `boolean` or an `enum` is copied out and is not region memory, so `serve`'s `out[k] = s.payload[k]` is allowed | **NL2556** (new) |
| outer memory that is not a number, `boolean`, `enum` or string literal stored into region memory: a pass scope could release it while the region still points at it. Storing covers a field or element store, a constructor argument (`new Game(g.host)` stores `g.host` into the region's `Game`) and a field or element of an object or array literal | **NL2557** (new) |
| `enter`'s `f` answers anything but a number, `boolean` or `enum` | **NL2558** (new) |
| `region`'s or `regionWith`'s `f` answers anything but memory it allocated, directly or through a callee that answers fresh memory: `region(() => moduleValue)` and `regionWith(g, (a) => a)` would make outer memory the root, and `enter` would then hand it to `f` as region memory, where NL2557 no longer guards it. NL2423's rule for a `using a = arena()` block's `return`, turned round | **NL2561** (new) |
| `scope()`, `spawn`, a parallel body or a channel inside `f`, directly or through a callee: another thread allocates from its own arena | **NL2559** (new) |
| a value whose type holds a `Region` at any depth (itself, a field, an element, a `Map` key or value) crossing to another thread: a task's argument or its answer, a parallel body's capture, element or result, a value sent on a channel | **NL2560** (new) |
| growth of outer storage inside `f`, directly or through a callee: a `push` onto an outer array (`out.push` in `serve`), a `Map.set` or `Set.add` on an outer `Map` or `Set`, which would move its storage into the region | NL2422 for `push`, inherited, and its siblings for `Map.set` and `Set.add` as the arena block refuses them today (`reject_using_arena_map_set`) |
| `Arena.release` or `Arena.reset` inside `f`, or a callee that reaches either | NL2426, reused |
| a call the analysis has no facts for | NL2425, reused |
| `region`, `regionWith`, `enter`, `enterWith` or `free` in a parallel body or a task's function, directly or through a callee | NL2351, reused |

NL2560 is a rule on types, not on values, so a handle hidden in a field of a
`regionWith` argument, in a callee's answer or in a parallel body's capture is
caught where it crosses, whatever route brought it there. A handle stored in
region memory or answered by a callee on the same thread is a number and is
allowed; freeing the outer region first leaks the inner one (§6). The runtime's thread check (above) backs the rule for a handle that
crosses as a bare integer.

NL2351's message (`arenaMessage` in `src/parallel.ts`) gains the five names:
"a parallel body may not call `Arena.mark`, `Arena.used`, `Arena.release` or
`Arena.reset`, open a `using a = arena()` block, or call `region`,
`regionWith`, `enter`, `enterWith` or `free`". A spawned task's function
reaches the same message, because `src/compilation.ts` checks a `spawn`'s
callee through `arenaMessage` as it does a parallel body; the facts gain one
bit, `usesRegion`, set by the five calls and folded through callees as
`usesArenaControl` is.

`using a = arena()` inside `f` is allowed: it marks and releases inside the
region, with NL2416–NL2427 as they stand. The automatic pass scopes do the
same. `enter` of a second region inside `f` is allowed too, because only
numbers come out of it. `enter` or `enterWith` of a region already entered
panics, as above, and so does `free(r)` while `r` is entered.

**The three shapes.**

- *`new`*: a constructor run inside `f` is a call and is followed like one. A
  constructor that stores `this` or a field into module state is NL2556.
  `new Region` is refused, as `new Secret` is: the class has a private
  constructor in `runtime/nish.d.ts` and the checker refuses the name.
- *Every declarator of a `using`*: a region is not disposed by a block, so
  `using r = region(f)` is refused by NL2387, the rule that `using` takes only
  `scope()`, `lock()` or `arena()`. Its negative tests cover the declarator in
  every position: `using a = arena(), r = region(f)` and
  `using r = region(f), a = arena()`.
- *`this` leaving a constructor*: `h.l = this` with `h` the `arg` is NL2556,
  and handing `this` to a callee that stores it is NL2424's shape and is
  refused the same way.

**Runtime and ABI.** A new unit, `runtime/runtime-region.c`, holds the
process-wide table. Each slot is a `struct nish_arena`, the thread that made
it, a generation, an entered flag and the size of its next chunk. `nish_region_enter` swaps the
thread's `nish_arena` with the slot's, and `nish_region_leave` swaps it back:
two 32-byte copies. The arena's layout, its 32 bytes and its `_Static_assert`s
do not change.

The one change to the arena itself is the size of a chunk. Today
`nish_arena_grow` takes at least 64 KiB, which is right for one arena a
process and wrong for a hundred thousand of them. Prototype `r` (§4) shows it:
100,000 regions of 64 KiB chunks reserve 6.6 GB of address space and keep
447 MB resident, one touched page per chunk. A region's first chunk is
therefore sized to its first allocation, and each later chunk doubles, or
takes the allocation's own size when that is more. The first allocation is
the one `region`'s `f` makes first: in §1's cache the `Session` root, so the
payload, whose length `f` does not know when the chunk is made, grows a
second chunk. Prototype `rs` measures exactly that. The
size is kept in a thread-local that `enter` sets and `leave` restores, read
only on `nish_arena_grow`'s slow path. `nish_alloc_struct`'s inlined fast path
is unchanged, so a program that does not use regions emits the same `.ll`
(§5).

**Fragmentation.** A region's chunks come from `malloc` and go back to it
whole. Prototype `rs` keeps 33.2 MB resident for 100,000 live sessions whose
payloads average 136 bytes, against 22.8 MB for one `malloc` box each (`c`).
The 10.4 MB between them, about 104 bytes a region, is the region's 32-byte
arena, two chunks where `c` has one (two 16-byte chunk headers and two
`malloc` headers), and the second chunk's slack: it doubles the 72-byte root
chunk to 144 bytes, so a payload shorter than that leaves the rest unused.
What stays is `malloc`'s own fragmentation across sizes, which `rs` did not
show over 2,000,000 requests.

### 2.2 A safe arena reset

**Semantics.** `Arena.reset` is deprecated because nothing checks that the
memory it recycles is dead (NL7001). Making it safe for a cache leaves one
form: an *evacuation*. The cache keeps its sessions in an arena of their own,
and when that arena has bumped twice the live bytes, plus 64 KiB so a tiny
live set does not flip on every request, the program copies the live
graph into a fresh arena and frees the old one.

```ts
class Cache {
  live: Arena<Sessions>                 // the sessions, in an arena of their own
  get(id: i64, out: u8[]): i32 {
    // ... as in §2.1, but allocating into this.live
    if (this.live.since() > 2 * this.liveBytes + 65536) {
      this.live = evacuate(this.live)   // copy what the root reaches, free the rest
    }
    // ... answer as in §2.1
  }
}
```

The relay would evacuate its session arena on a timer.

**Checker rules.** `evacuate` is sound only if the root is the only way into
the arena. Proving that is the region's rule from §2.1: NL2556–NL2561 again,
plus a copy whose cost scales with the live set.

**The three shapes** are covered exactly as for regions, because it is a
region that is periodically copied.

**Runtime.** A copying walk over the root's type. It needs the type's layout at
runtime, which the compiler does not emit today. The walk is also a pause.

### 2.3 Reference counting

**Semantics, on every value.** Each object, array and string carries a count.
A store of a pointer retains the new value and releases the old, and leaving
a scope releases its locals. A value is freed when its count reaches zero.

**Semantics, opt-in `Rc<T>`.** Only boxed values are counted:

```ts
import { Rc, borrowWith, rcWith, release } from "nish:rc"

class Cache {
  boxes: Map<i64, Rc<Session>>
  // get() as in §2.1, with rcWith(id, open) for regionWith, release(old) for
  // free(old), and borrowWith(box, out, serve) for enterWith
}
```

The relay would hold an `Rc` per slot and `release` it in `close`. The
`Session` holds a `u8[]`. If that array came from the arena, the box would
free the session and leak its payload, so the box has to own everything its
constructor allocates. That makes `rcWith` the same call as `regionWith`, and
`Rc<T>` the same thing as a region with a count.

**Checker rules.** On every value: none new, but every pointer store and every
scope exit changes code. For `Rc<T>`: NL2556–NL2561 as for regions, plus a
code for a box handed to another thread unless its count is atomic.

**The three shapes.** On every value they need no rule: a constructor's stores
retain like any other. For `Rc<T>` they are the region's.

**Runtime and ABI.** On every value, a header word on each allocation, which
changes `nish_alloc_struct`, every array and string layout, and the ABI of
every exported function that takes one. Counts shared across threads have to
be atomic. **Cycles** are never freed: a parent and child that point at each
other keep each other alive. The way out is a cycle collector or weak
references, and either is a second memory model. For `Rc<T>`, the same as
regions, plus the count.

## 3. Interactions

**`Secret<T>` and `nish:secret`.** A holder dropped, or released with its
arena, without `wipe()` leaves its key in memory (LANGUAGE.md, "What the rule
leaves out"). `free` is a release, so the rule does not change: a session that
holds a key wipes it before its region is freed. `free` does not zero chunks,
just as `using a = arena()`'s release does not. A later stage could zero a
region's chunks on `free` when the region's root type holds a `Secret`. That
needs no new rule, and it costs a `memset` of the region.

**`nish:net` slot buffers.** QUIC-3, H3-1 and H3-3 closed by moving every
per-connection buffer into a slot made once and reused
([security/quic.md](security/quic.md), [security/http3.md](security/http3.md)).
TLS-3 closed the same way ([security/tls.md](security/tls.md)). Regions do not
replace that, and nothing in `std/net` moves to them: a slot costs no `malloc`
and no handle check, and its cap is the configuration's. The records that are
still open, H1-3 (58 bytes per WebSocket accept) and H2-1 (664 bytes per HPACK
block), could later close with a region per connection, freed when the slot is
reset.

**`scope()` and pass scopes.** A pass scope inside `f` marks and releases in
the region (§2.1). A `scope()` inside `f` is refused (NL2559): its tasks would
allocate from their own threads' arenas and answer into the region.

**Spawn and parallel bodies.** A region belongs to the thread that made it,
like the arena it swaps. A value whose type holds a handle is refused where it
would cross to another thread (NL2560). A handle smuggled through an integer
reaches a slot whose recorded thread is not the caller's, and `enter` panics.
A parallel body or a task's function may not call `region`, `regionWith`,
`enter`, `enterWith` or `free` (NL2351).

The five calls are panic sites: `enter`, `enterWith` and `free` for the checks
above, `region` and `regionWith` for a full slot table. A `malloc` that
refuses is the `oom` kind, as for any arena allocation: listed with
`"allowed": true`, it never makes a function one that may panic. Stage 2 adds them to `docs/LANGUAGE.md`'s panic-site table as a kind
of their own, `region`, so under `--deny-panics` a call to one in a module of
the scope is NL2457, and a call from the scope into a function outside it that
reaches one is NL2458, as for every other kind ("The no-panic scope"). Its
negative is `tests/cases/reject_deny_panics_region`.

**wasm32 and wasi.** The `--profile wasi` route links `runtime.c` and the
units `scripts/build.sh`'s `halves` pairs with it (build.sh:152), so
`runtime-region.c`, paired there in stage 1, reaches wasi with no change of
its own. `malloc` and `free` are wasi-libc's, so a freed region's chunks are
reused by the next one. Linear memory never shrinks, so the peak stays
resident. That is enough for N9's other half, the client core's per-match
state: one region a match, freed when the match ends, so each match reuses
the last one's memory rather than adding to it.

The freestanding `--profile wasm` route is another matter. It links
`runtime-wasm.c` rather than `runtime.c`, with `-nostdlib`: one arena grown
by `memory.grow`, no chunk list, no `malloc` and no `free`, so a region's
chunks have nowhere to come from and nowhere to go back to. Regions are
refused there. The wasm route already greps the user's IR for
`@nish_aes_hw(` to add `runtime-aes.c` (build.sh:~394); stage 1 adds a grep
for `@nish_region_` beside it that exits 2 with a message naming `--profile
wasi`, rather than leaving the link to fail on an undefined symbol. A wasm32
guard in the compiler would not see this route, because it links IR compiled
for the host (CLAUDE.md, #598).

## 4. The options, measured

`bench/wp46-memory/options.c` holds the same cache as §1 in C, once per option,
linked against `runtime/runtime.c` so the arena variants use today's
`nish_alloc_struct`.

| Variant | What it is |
| --- | --- |
| `a` | today: sessions bumped from the arena, never freed |
| `a2` | `a` again, the same functions compiled a second time under other names and picked at run time, for the noise band |
| `r` | a region per session, 64 KiB chunks, freed on eviction |
| `rs` | `r` with the first chunk sized to the root alone (the payload grows a second chunk, twice that or its own size), and allocated without the swap |
| `s` | safe reset: evacuate the live sessions once the arena passes twice their bytes |
| `c` | opt-in `Rc`: a `malloc`'d box holding session and payload, a retain and a release per request |
| `ca` | `c` with atomic counts |
| `g` | counting everything: session and payload counted apart, the response `malloc`'d, a retain and a release per reference the request loads (the session from the table, the payload from the session) |

Only `r` and `rs` carry a region's arena (an `rsession` around the session),
so every other variant's session is the 40 bytes it needs. Neither `r` nor
`rs` models the handle table: the thread, generation and entered checks are a
few loads and compares per `enter` that the figures leave out. `g` is a lower
bound on counting everything, because a compiler that cannot prove a field
read safe counts it too.

`bench/wp46-memory/rc-tax.c` measures the tax that counting puts on code that
only reads: a random walk over `n` arena objects, plain, with an inline
count (`rc`; at `-O2` the optimiser folds the increment and decrement and
keeps only the zero test, so it is what is left when a compiler sees both ends
of the pair), with a call per retain and release (`call`, as a compiler that does
not inline its runtime would emit), and with atomic counts.

```sh
npm run build && node bench/wp46-memory/run.mjs --rounds 9
```

Each round runs every variant once, in a fresh process, in an order shuffled
afresh for the round (seeded, so a rerun repeats it), so no variant always
follows the same one. A figure is the median over nine rounds. The ids change on every
request (xorshift), and every variant prints the same checksum of what it
served, which the script checks. The noise band is the median over rounds of
the gap between `a` and `a2`. A shared VM is noisy, and the band says how
noisy. The memory rows are medians too: the anonymous resident set at exit
(statm's resident less shared), the peak resident set (status's `VmHWM`,
which also counts the binary's own pages, about 1.6 MB), and the minor page
faults (`getrusage`'s `ru_minflt`). Figures are from one such run.

**Churn, 1,000 live** (`options <v> 2000000 1000`; noise band 13.7%):

| | `a` | `r` | `rs` | `s` | `c` | `ca` | `g` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ns/request | 278.3 | 218.9 | 205.4 | 217.2 | 186.5 | 194.2 | 184.4 |
| vs `a` | 1.00 | 0.79 | 0.74 | 0.78 | 0.67 | 0.70 | 0.66 |
| anonymous resident at exit | 323.1 MB | 4.6 MB | 0.46 MB | 0.92 MB | 0.37 MB | 0.37 MB | 0.38 MB |
| peak resident | 324.7 MB | 6.2 MB | 2.1 MB | 2.5 MB | 2.0 MB | 2.0 MB | 2.0 MB |
| minor faults | 78,958 | 1,187 | 188 | 6,458 | 166 | 166 | 168 |

**Churn, 100,000 live** (`options <v> 2000000 100000`; noise band 7.0%):

| | `a` | `r` | `rs` | `s` | `c` | `ca` | `g` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ns/request | 482.4 | 898.9 | 469.9 | 450.9 | 406.5 | 457.0 | 430.7 |
| vs `a` | 1.00 | 1.86 | 0.97 | 0.93 | 0.84 | 0.95 | 0.89 |
| anonymous resident at exit | 326.7 MB | 447.5 MB | 33.2 MB | 75.0 MB | 22.8 MB | 22.8 MB | 24.0 MB |
| peak resident | 328.3 MB | 449.1 MB | 34.8 MB | 76.6 MB | 24.4 MB | 24.4 MB | 25.6 MB |
| minor faults | 80,336 | 109,834 | 8,699 | 32,028 | 6,145 | 6,145 | 6,451 |

**Mostly hits, 1,000 live** (`options <v> 4000000 1000 2`, ids from twice the
cache; noise band 4.3%):

| | `a` | `r` | `rs` | `s` | `c` | `ca` | `g` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ns/request | 174.7 | 139.0 | 142.6 | 146.1 | 137.4 | 147.0 | 130.5 |
| vs `a` | 1.00 | 0.80 | 0.82 | 0.84 | 0.79 | 0.84 | 0.75 |
| anonymous resident at exit | 359.0 MB | 4.6 MB | 0.46 MB | 0.88 MB | 0.37 MB | 0.37 MB | 0.38 MB |
| peak resident | 360.6 MB | 6.2 MB | 2.1 MB | 2.5 MB | 2.0 MB | 2.0 MB | 2.0 MB |
| minor faults | 87,715 | 1,187 | 187 | 7,043 | 165 | 165 | 167 |

In the run's last round, the evacuation's longest pause was 0.29 ms over 761
flips at 1,000 live, and 20.0 ms over 9 flips at 100,000 live.

**The counting tax** (`rc-tax <v> <n> <steps>`):

| objects | noise band | `plain` | `rc` | `call` | `atomic` |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1,024 | 1.3% | 2.38 ns | 1.13x | 1.42x | 5.74x |
| 1,048,576 | 10.1% | 22.06 ns | 1.21x | 1.87x | 2.09x |

What the figures say:

- **Speed does not decide it.** At 1,000 live every bounded option beats
  today by 16–34%, past the 13.7% and 4.3% bands. The likely cause, a
  hypothesis the fault counts support rather than prove: the leaking arena
  touches a new page every few requests, 78,958 minor faults against 166–188
  for `c` and `rs`, and the bounded ones reuse warm memory. The 0.15 s
  between `a` and `rs` over the run comes to 1.85 µs per extra fault, a
  plausible price for a fault that zeroes a fresh page. At
  100,000 live, where the band is 7.0%, the picture splits: `c` is 16% faster
  than today and `g` 11%, past the band, while `rs` (0.97x), `s` and `ca` are
  inside it, no different from today on this run. `rs` is 15.6% slower than
  `c` there (469.9 / 406.5 ns): it makes two `malloc`s a session where `c` makes one, and touches
  some 104 more bytes. The real region adds the handle checks `rs` leaves out.
- **Memory decides it.** `rs`, `c` and `g` hold the live set and little else:
  0.4–0.5 MB at 1,000 live, 23–33 MB at 100,000, where `rs` pays about 104
  bytes a region over `c`. The evacuation holds 1.9–2.3 times what `rs` holds
  (0.92 MB and 75.0 MB) and pauses for a time that grows with the live set. A
  region with 64 KiB chunks (`r`) is worse than today at 100,000 live,
  447.5 MB and 1.86x, which is why the region's first chunk is sized to its
  first allocation.
- **Counting everything taxes code that never frees.** A walk through
  counted pointers costs 1.42–1.87x when each retain and release is a call,
  and 2.09–5.74x when the counts are atomic, in every program, not only the
  servers that need it. The inline `rc` figure, 1.13x over 1,024 objects (band
  1.3%) and 1.21x over a million (band 10.1%), is the best case: the optimiser
  folded the pair to a zero test, which it can do only where it sees both ends
  of it in one function.

## 5. WP33: no golden moves for a program that does not use it

A module's `.ll` declares only the runtime functions it calls:
`tests/cases/add.ll` declares two functions, and `mem_using_arena.ll` ten.
The region's declarations (`nish_region_new`, `_enter`, `_leave`, `_free`)
therefore appear only in a program that imports `nish:region`, and the chunk
size change lives in `nish_arena_grow`'s body in `runtime/runtime.c`, which no
golden contains. Regions keep WP33's rule. The stage that builds them checks
it with a full `npm test` in which no `tests/cases/*.ll` is updated, and records
`bench/instructions.json` before and after, since the runtime's code size can
move it. The code size has a ratchet of its own: `tests/runtime-budgets.js`
holds `runtime/runtime.c`'s `.text` at `RUNTIME_TEXT_BUDGET` (3,684 B) and
`RUNTIME_THREADS_TEXT_BUDGET` (3,885 B), and both measure exactly at their
ceilings today, so stage 1 raises them by what the chunk-size read adds and
records the new figures beside them.

The safe reset keeps it as well, for the same reason. `Rc<T>` keeps it. Counting
every value does not: every store of a pointer gains a retain and a release, so
every golden with a pointer store moves, along with `nish_alloc_struct`'s
inlined path.

## 6. Decision

**Regions, as in §2.1.** They bound memory to the live set (33.2 MB for
100,000 sessions where today grows without bound, at 0.97x today's time per
request, inside that run's 7.0% band). The bound holds for regions the program
frees: a handle stored only inside a region that is then freed is lost with
it, and the region it names leaks, as a `malloc`'d pointer kept only in freed
memory does. A program that nests regions frees the inner ones first. They leave the `.ll` of a program that
does not use them unchanged and add no time to any of its paths, though the
runtime's `.text` grows by the region unit and the chunk-size read (stage 1's
budgets). They reuse the arena block's rule and its codes, and leave the
arena's ABI as it is.

Sizing `rs`'s first chunk to the root alone, as a real region must, rather
than to the whole session, does not change the recommendation. It costs
memory, 33.2 MB where the earlier prototype held 27.6 MB (and measured
1.07x today's time, in a run whose band was 1.0%), and moves `rs` further
from `c`, but it leaves `rs` bounded and no slower than today, while
the options it is weighed against lose on memory, on pauses or on every
program's time.

**Rejected:**

- **A safe arena reset.** Making it safe needs the region's rule anyway, and on
  top of that it holds 1.9–2.3 times what `rs` holds and pauses for a time
  proportional to it: 20 ms at 100,000 live sessions, more than a game tick.
  It also needs type layouts at runtime, which nothing else needs.
- **Counting every value.** It taxes every program for the servers that need
  it: 1.42–1.87x on a pointer walk with calls and up to 5.74x with atomic counts,
  every golden moves, the ABI of every exported function changes, and cycles
  leak without a second collector.
- **`Rc<T>` now.** Its prototype `c` measured 13.5% faster than `rs` at
  100,000 live and 10.4 MB smaller, but only because it packs the session and
  its payload into one `malloc` whose size the prototype knows. A real box
  has to own whatever its constructor allocates, which makes it a region with
  a count, with the region's arena, its second chunk and its allocation path.
  The count buys sharing a value between several owners, which the cache and
  the relay do not need. A single owner frees its region directly. `Rc<T>` stays
  possible on top of regions (§7, not in this work package).

## 7. Stages

| Stage | What | Files | Negative tests | `src/` may use it from |
| --- | --- | --- | --- | --- |
| 1 | The runtime. The region table, `nish_region_new`/`_enter`/`_leave`/`_free`, the thread, generation and entered checks, the region chunk size. A C test that frees a hundred thousand regions and reads RSS flat. | `runtime/runtime-region.c` (new; paired in `scripts/build.sh`'s `halves` and `src/run-cache.ts`'s `runtimeUnits()` in one commit), `runtime/runtime.c` (`nish_arena_grow`), `scripts/build.sh --profile wasm`'s refusal of IR that names `@nish_region_`, `tests/runtime-budgets.js`: a ceiling row for the new unit, and `RUNTIME_TEXT_BUDGET` (3,684 B) and `RUNTIME_THREADS_TEXT_BUDGET` (3,885 B) raised by what the chunk-size read adds to `nish_arena_grow`, since both measure exactly at their ceilings today | a zero handle panics in `enter`, `enterWith` and `free`; a stale handle panics, `free` twice included; `free` of an entered region panics; `enter` and `enterWith` of a region already entered panic, directly and through a nested `enter`; a handle from another thread panics; `--profile wasm` of IR that calls `nish_region_new` exits 2 with its message | — (no construct) |
| 2 | The language. `nish:region` with NL2556–NL2561 and NL2351's wider message, its lowering, the guide page, `docs/LANGUAGE.md`'s section, and the cookbook entry. | `src/` (the builtin module, the checker rule beside `src/escape.ts`'s arena rule, `src/parallel.ts`'s `arenaMessage`, codegen), `src/runtime.ts` and the cookbook's runtime prelude (`docs/cookbook/regen.sh`), `runtime/nish.d.ts`, `runtime/nish.mjs`, `std/region.ts` if it carries source like `nish:secret`, `tests/cases/` with the differential goldens (`node tests/differential/goldens.js --update`), `tests/self/goldens/checked.txt` and `checked-self.txt` (`node tests/self/goldens.js --update`), `docs/LANGUAGE.md`, `docs/guide/` | one per code, plus the three shapes: a constructor reached by `new` that stores `this` into module state; `using` of `region()` as each declarator; `h.l = this` with `h` the `arg`; NL2561's `region(() => moduleValue)` and `regionWith(g, (a) => a)`; NL2560's handle in a field of a task's argument, in a task's answer, in a `Map` sent on a channel and in a parallel body's capture; NL2351's `enter` in a spawned function and through a callee of a parallel body; NL2422's growth of outer storage inside `f`: `out.push` inside `serve`, `Map.set` and `Set.add` on an outer collection, and each through a callee; NL2557's outer string as a constructor argument and inside a literal; `reject_deny_panics_region`; then a negative golden after `churn()` for each element type the rule leaves out (CLAUDE.md, #520) | the first release cut after stage 2 merges (0.19.0 at the earliest, against today's 0.18.0 seed) |
| 3 | The proof. The §1 server rewritten with regions, as a `tests/link` soak that reads `Arena.mark()` and anonymous resident memory flat across 2,000,000 requests, and WP34 N9's game-server note closed. | `bench/wp46-memory/`, `tests/link/`, `docs/wp34-hosting-cs.md` | — | — |

The compiler itself has no long-lived state and does not need regions; the
column says only when the rolling freeze would allow it.

## Not in this work package

- `Rc<T>` on top of regions, for a value with several owners.
- Zeroing a region's chunks on `free` when its root holds a `Secret` (§3).
- Moving `std/net`'s slot pools to regions; they stay slots (§3).
- H1-3 and H2-1, whose fix is a region per connection once stage 2 lands.
