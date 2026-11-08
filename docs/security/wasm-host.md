# Security record: the wasm-host boundary — module storage, windows, panics and `nish/page`

The record of WP50 stage 3 (`docs/wp50-wasm-host.md` §5, §6, §11, §12): the
boundary between a module built with `--profile wasm-host` and the page that
loads it. It covers the panic import, the generated loader's guard around
every export, the buffer windows a host import is lent, the ring the page and
the program share in module storage, and the page-side handle table. It says
what each side may hand the other, what is refused, and the test that pins
each property. It is written against `924c5779` in PR #1273, and its lines are
cited there; the later commits of that PR, the merge of `main` included, change
none of the cited lines.

**Result.** The module reads nothing the page names outside the memory it
owns, and a page that calls back into a module mid-call or after a panic is
refused before the module runs.

Stage 4 (`docs/wp50-wasm-host.md` §7) adds strings to the boundary: a host
import's string argument and an export's string result cross as UTF-8 bytes
the loader decodes, and text the page writes reaches the module through a
`u8[]` of module storage (`nish/host/text`). It adds WH-9: the decode is of
a pair the module makes, which the loader reads inside memory or not at all,
and the module's reader holds every count against its buffer (see "A string
crosses as bytes inside memory" below).

There are nine findings. Eight are fixed by the stage that found them, and
WH-8 is recorded open:

- **WH-1 (High):** a window's `at + n`, added in 32 bits, wraps, so a host
  call is lent memory past the end of the array.
- **WH-2 (Medium):** ring counts written out of protocol index outside the
  ring's slots.
- **WH-3 (Medium):** a call into the module from inside an import, or from
  the panic reporter, runs on state the outer call is still changing.
- **WH-4 (Medium):** `HostTable`'s handle check searched the free list, so a
  page holding many taken slots spent quadratic time.
- **WH-5 (Low):** a panic message the module places outside memory.
- **WH-6 (Low):** handle 0, a taken slot or a forged number answered
  `undefined`.
- **WH-7 (Low):** an argument of the wrong shape threw from inside the
  guard, so a page's mistake killed the module.
- **WH-8 (Low, open):** storage holds what the page wrote, so an enum,
  ranged or `boolean` storage element can hold a value outside its type.
- **WH-9 (Low):** a string's `(p, n)` or `{ i64 len }` header the module
  places outside memory.

## Scope

| File | Functions |
| --- | --- |
| `runtime/page.mjs`, `runtime/page.d.ts` | `HostTable` (`add`, `get`, `take`, `#check`), `ringOver`, `reportPanic` |
| `std/host/ring.ts` | `ringCapacity`, `ringCount`, `ringSize`, `ringFree`, `ringPush`, `ringShift`, `ringClear` |
| `runtime/runtime-wasm.c` | the `nish.panic` import (`nish_host_panic`, `NISH_DIE`) under `NISH_WASM_HOST` |
| `src/interop-wasm.ts` | the generated loader: `panicText`, `panicOf`, `guardLoader` (`guarded`, `refuse`, `typedIn`, `stringOut`), `payloadIn`, `resultIn`, `arrayIn`, `hostImportsOf` (`hostFn`, `win`, `text`), `pushHostEntry`, and `layoutLoader` (`layout`, `views()`) |
| `src/interop-wasm.ts` | `wasmTypedIn`, `wasmPayloadWriter` and `refused`: where the generated wrapper checks each argument |
| `src/emit-strings.ts` | `emitHostWindow`: a window's bound in the module |
| `src/attributes.ts` | `hostWindowProven`: when a window's bound is proven and the check is left out |
| `src/interop-wasm.ts` | the generated loader's string decode: `text` (a host import's argument) and `stringOut` (an export's result) |
| `src/emit-strings.ts` | `emitHostString`: a string argument as its data pointer and byte count |
| `src/module-storage.ts` | lending a `u8[]` storage array to a function's `u8[]` parameter |
| `std/host/text.ts` | `textRead`, `textWrite`, `textWriteInt`, `textWriteF64` |

Out of scope:

- The page and the program, which are trusted (see the threat model).
- `--profile wasm`, which links no panic import: each panic there is the bare
  trap it was before this stage.
- A program with neither module storage nor a host module, under any
  profile: it gets the unguarded loader it had before this stage, with no
  panic import, no re-entry guard and no dead-module state (WH-3), because
  with no import there is nothing to call back through, and a trap leaves
  only the arena, which the loader's `scoped` releases.
- The `--emit-ts` reading's `nish-storage.ts`, which runs as JavaScript on
  typed arrays: an index outside a scalar storage reads `undefined` and
  writes nothing, one outside a record storage finds no row and throws a
  `TypeError`, and there is no linear memory to leave.

## Threat model

The attacker supplies data the page passes on: arguments to the module's
exports, words the page pushes into a ring, and handles the program hands
back to the page's host functions. The program may compute a window's `at`
and `n` from that data.

A win is any of:

- a host function lent bytes outside the array the program named;
- a ring read or write outside its slots;
- a module run while it is already running, or after it panicked;
- the loader reading a panic message outside the module's memory;
- a host object reached through a handle no `add` answered;
- time the page spends without a bound the input sets linearly.

The page's code, the program and the compiler are trusted. A host function
is handed a view of the whole memory (`win()`), so a page that indexes past
the window it was lent reaches the rest of the module; that is the page's own
code, and the guide says to read only `[at, at + n)`.

## Findings

| Id | Severity | Where | Description | Disposition |
| --- | --- | --- | --- | --- |
| WH-1 | High | `src/emit-strings.ts:632`–`:662` (`emitHostWindow`) | A window is `(array, at, n)`, both `u32`. Checked as a 32-bit `at + n <= len`, `at = 16, n = 0xFFFFFFF8` sums to 8 and passes against any array of 8 or more elements, and the page is told it may write about 4 billion elements from element 16: the rest of the module's memory, corrupted from attacker-chosen `n`. | **Fixed.** `at` and `n` are zero-extended and added in `i64`, then held against `len` with `icmp ule`; a failure panics as `ffi-length` before the import runs. A proven `0, len` lending skips the check ("host-import-window: `at + n` is added in i64 and held against the length, so a sum that wraps in 32 bits still panics", "host-import-window: a window past the end panics before the page runs, and one whose `at + n` wraps does too", "host-import-window: lending `0, toU32(xs.length)` is proven, so the call has no window check"). |
| WH-2 | Medium | `std/host/ring.ts:44`–`:124`; `runtime/page.mjs:76`–`:137` (`ringOver`) | The head and tail live in module storage, which the page writes. A count of -7 or 2³¹-1 used as `count % capacity` indexes a negative or out-of-ring slot, and a size past the capacity lets `push` overwrite unread words. | **Fixed.** Both halves reduce every count into `[0, 2 * capacity)` before using it and cap a size at the capacity, so a full-looking ring refuses `push` and `shift` stays in the slots ("link/std_host_ring: exits with 0 and stdout matches expected.out", whose `forged:` lines write out-of-protocol counts; "WH-2: ringOver reads forged counts (-7, 2^31 - 1, a size past the capacity) without a word outside the ring", the page half's before/after: guard words on both sides of the ring keep their bytes and `size` stays in `[0, capacity]`; "page: ringOver reads and writes the module's rings both ways through memory and layout"). |
| WH-3 | Medium | `src/interop-wasm.ts:904`–`:920` (`panicOf`), `:938`–`:985` (`guardLoader`) | A host import can call an export while the module's call is still on the stack, and the inner call runs on half-changed state. The `onPanic` reporter can too, and its call runs on the state the panic interrupted. | **Fixed.** Every export of a program with module storage or a host module runs in `guarded`, which refuses a busy module with `NishReentry` and a dead one with `NishPanic`, both before the module is touched (a program with neither has no import to call back through and keeps the unguarded loader, §6 of docs/wp50-wasm-host.md); `panicOf` marks the module dead before it calls the reporter, so a reporter that calls back in gets `NishPanic`; a trap, a re-entry or an exception escaping a call kills it, tagged `trap`, `reentry` or `exception` ("panic: an import that calls back into an export throws NishReentry, and the inner call never ran", "panic: panic(message) carries the program's words, and a reporter that calls back in gets NishPanic", "panic: a dead module answers every later call with NishPanic, before it runs", "panic: an exception escaping a host import kills the module"). |
| WH-4 | Medium | `runtime/page.mjs:20`–`:65` (`HostTable#check`) | The check refused a taken slot with `this.#free.includes(handle)`, O(free) per call: 200,000 gets beside 200,000 taken slots is 4·10¹⁰ comparisons, enough to stall a page that frees what an attacker had it allocate. | **Fixed.** A taken slot holds a private `EMPTY` symbol and the check reads the slot ("page: HostTable's check reads the slot, not the free list: 400,000 gets beside 200,000 taken slots take under a second"). |
| WH-5 | Low | `src/interop-wasm.ts:878`–`:899` (`panicText`) | `panic(message)` hands the loader `(msg, len)`. Read as `new Uint8Array(buffer, msg, len)`, a pair outside memory throws a `RangeError` from inside the panic path, and one whose sum wraps is read from the wrong place. Only the module calls the import, so this is hardening. | **Fixed.** Both are read as `u32` and held against the buffer's size without adding them; a message outside memory reads as "panic (its message is outside memory)" ("panic: a panic message the module places past the end of memory, or wrapping it, is not read"). |
| WH-6 | Low | `runtime/page.mjs:20`–`:65` (`HostTable`) | A handle the program forged, 0, a fraction or a taken slot read as `undefined`, which a host function would pass on. | **Fixed.** `#check` throws a `RangeError` for each, which inside an import kills the module (WH-3), and slot 0 is never handed out ("page: HostTable hands out 1 and up, never 0, reuses a taken slot, and throws on a taken, zero, forged or fractional handle"). A stale handle kept after `take` names the newer object once its slot is reused: the program is trusted (threat model), so that is its bug, not a win, and the table carries no generation count. |
| WH-7 | Low | `src/interop-wasm.ts:750`–`:756` (`payloadIn`), `:757`–`:775` (`resultIn`), `:1088`–`:1114` (`arrayIn`) | Only a number of the wrong type was refused before the module ran. A malformed `Result`, a payload of the wrong JavaScript type, or a Proxy or re-prototyped `DataView` passed as a typed array threw from inside `guarded`, which then marked the module dead: one bad call from the page ended it for good. | **Fixed.** Every argument is checked before the call: a `Result` must be an object whose `ok` is a boolean and whose payload has its arm's JavaScript type, read once through a `try` so a throwing getter is the caller's error; an array must pass the `%TypedArray%` brand getter and is measured with the `length` getter, neither of which runs caller code. A typed array over a detached buffer is not refused: `length` reads 0, so it is copied in as an empty array and the call runs (pinned: the check expects `ok 0`). Each refusal is a `TypeError` tagged so `guarded` lets it through and the module stays alive ("panic: an argument of the wrong JavaScript type is a TypeError before the module runs, which stays alive", whose lines include a BigInt given to an `i32`; "panic: a Result payload or an array of the wrong shape is a TypeError before the module runs, which stays alive"). |
| WH-8 | Low | module storage, as the module reads it | The page can write any bits into storage, so an enum, ranged or `boolean` storage element may hold a value outside its type, and the module reads it as written. | **Open.** The page is trusted (threat model), so a value it forged is its own bug; a program that reads storage the page writes checks the value where it matters, as `std/host/ring` does (WH-2). See "Storage holds what the module wrote" below. |
| WH-9 | Low | `src/interop-wasm.ts:1144`–`:1152` (`guardLoader`'s `stringOut`), `:1353`–`:1362` (`hostImportsOf`'s `text`) | A string crosses as a pair the module makes: `(p, n)` for a host import's argument, a `{ i64 len, data }` header for an export's result. A pair past the end of memory, or one whose address wraps, would read the wrong bytes or none, and bytes that are not UTF-8 would reach the page as whatever a decoder makes of them. Only the module makes these pairs, so this is hardening, the shape of WH-5. | **Fixed** (stage 4, by construction): each pair is read as `u32` into `new Uint8Array(buffer, p, n)` or a `DataView`, which throw a `RangeError` for any view past the end, so nothing outside memory is read; inside an export that error kills the module (WH-3); `TextDecoder` reads bytes that are not UTF-8 as U+FFFD ("host-import-text: WH-9: a forged string pair or header past the end of memory is a RangeError, and bytes that are not UTF-8 read as U+FFFD", which forges both through the adapter and through a string export). |

## Properties verified

Each property below is pinned by a test that fails if it stops holding,
except where it says otherwise.

**A window is inside its array before the page sees it.** `at + n` is added
in 64 bits and held against the length unless the compiler proved it; the
loader turns the data pointer into an index into a whole-memory view of the
element type and adds `at` (WH-1). Pinned by the `host-import-window:` checks
above and "host-import-window: the loader's adapter passes a whole-memory view, the pointer as an index plus `at`, and `n`".

**A ring never leaves its slots.** Whatever the counts hold, `ringSize` is in
`[0, capacity]` and `push` and `shift` index `2 + (count mod capacity)` (WH-2).
Pinned by the `forged:` lines of `tests/link/std_host_ring/main.ts` (the
Nish half) and "WH-2: ringOver reads forged counts (-7, 2^31 - 1, a size past the
capacity) without a word outside the ring" (the page half).

**One call at a time, and none after a panic.** (WH-3.) Pinned by the
`panic:` checks above.

**A panic ends the module, whatever the reporter does.** The reporter's
exception is swallowed and the `NishPanic` is thrown; the module is dead
before the reporter runs. Pinned by "panic: panic(message) carries the program's words, and a reporter that calls back in gets NishPanic" and "page: reportPanic writes `nish: <message>` to console.error".

**The panic import exists only under `--profile wasm-host`.** Under
`--profile wasm`, `NISH_DIE` is `__builtin_trap()` and the module imports
nothing from `nish`. Pinned by "panic: the wasm-host link imports nish.panic beside the host functions"; the `--profile wasm` side is verified by the wasm-size section's byte counts.

**Handles are checked in constant time.** (WH-4, WH-6.)

**A bad argument is the caller's error, not the module's.** (WH-7.) A
`TypeError` before the module runs, and the next call works. Pinned by the
`badarg` and `badshape` checks.

**A string crosses as bytes inside memory.** The loader decodes a string the
module passes, `(p, n)`, and one it returns, `{ i64 len, data }`, as
`new Uint8Array(memory.buffer, p, n)`. The constructor refuses a view past the end of the
buffer with a `RangeError`, so a pair the module got wrong can never read
outside its memory. Inside an import or an export call, that error kills the
module (WH-3). Bytes that are not UTF-8 decode as U+FFFD. Only the module
makes these pairs, from a string's header, so this holds by construction; WH-9
pins it with forged ones.
`textRead` and `textWrite` hold every count and offset against the buffer's
length before they touch it, so a count the page forged (negative, or past
the storage) answers `null` or -1 and writes nothing. Pinned by
"host-import-text: an echo that overflows its storage answers -1 and leaves
the bytes untouched" and by the `readBack` line of "host-import-text: text
the page writes with encodeInto, non-ASCII included, is read by the module
and echoed back".

**Hardening recorded, not fixed.** Each of these is the page's own mistake
reaching a module it loaded, and none lets the page read or write outside the
module's memory; they are left as they are and not counted:

- `copyBack` (`src/interop-wasm.ts:1121`) reads the page's array's
  `constructor` and `length` after the call, inside `guarded`, so a getter
  the page put there that throws marks a healthy module dead.
- `arrayIn` asks `nish_alloc_array` for the page's length; past 2³¹ - 1
  elements, or past the arena, the runtime panics (`memory`) and the module is
  dead, where a `TypeError` before the call would keep it alive.
- A `u8` or `u16` `Result` payload is checked to be an integer and masked to
  32 bits, not 8 or 16, so an out-of-range number is not refused.
- `nish_reset_arena` and `nish_free_arena` (`:1143`) are the module's raw
  exports, outside `guarded`: a host import that calls one mid-call releases
  the arena the running call is using, and nothing refuses it.
- `refused`, the set of errors `guarded` lets through, belongs to the loader
  module, not to one load: a refusal from one instance that a host import
  of another rethrows passes as a refusal there and does not kill it.

**Storage holds what the module wrote, not what its type says.** (WH-8.) The page
can write any bits into storage. An enum, ranged or `boolean` storage element
may then hold a value outside its type, and the module reads it as written,
the way it reads a forged ring count (WH-2). This is recorded open: the page
is trusted, so a value it forged is its own bug. A program that reads storage
the page writes checks the value where it matters, as `std/host/ring` does.

Tests:

- `` host-import-window: `at + n` is added in i64 and held against the length, so a sum that wraps in 32 bits still panics ``
- `` host-import-window: a window past the end panics before the page runs, and one whose `at + n` wraps does too ``
- `` host-import-window: lending `0, toU32(xs.length)` is proven, so the call has no window check ``
- `` host-import-window: the loader's adapter passes a whole-memory view, the pointer as an index plus `at`, and `n` ``
- `link/std_host_ring: exits with 0 and stdout matches expected.out`
- `page: ringOver reads and writes the module's rings both ways through memory and layout`
- `page: HostTable hands out 1 and up, never 0, reuses a taken slot, and throws on a taken, zero, forged or fractional handle`
- `page: HostTable's check reads the slot, not the free list: 400,000 gets beside 200,000 taken slots take under a second`
- `` page: reportPanic writes `nish: <message>` to console.error ``
- `panic: an import that calls back into an export throws NishReentry, and the inner call never ran`
- `panic: panic(message) carries the program's words, and a reporter that calls back in gets NishPanic`
- `panic: a dead module answers every later call with NishPanic, before it runs`
- `panic: an exception escaping a host import kills the module`
- `panic: a panic message the module places past the end of memory, or wrapping it, is not read`
- `panic: an argument of the wrong JavaScript type is a TypeError before the module runs, which stays alive`
- `panic: a Result payload or an array of the wrong shape is a TypeError before the module runs, which stays alive`
- `panic: the wasm-host link imports nish.panic beside the host functions`
- `host-import-text: text the page writes with encodeInto, non-ASCII included, is read by the module and echoed back`
- `host-import-text: an echo that overflows its storage answers -1 and leaves the bytes untouched`

All of them are in `tests/run.js`.

## Divergences from the native build

- **A panic.** A native panic prints and ends the process. Under
  `--profile wasm-host` the loader throws `NishPanic` and refuses every later
  call; the module's memory survives, as it is, for a page that reads it.
- **Re-entry.** A native program has no caller that can call back in. A
  module refuses one with `NishReentry` (WH-3).
- **A window is lent whole memory.** A native `declare function` gets a
  pointer and a length, and C could read past either; the page gets a view of
  all of memory and an index, and could too. Both are the trusted side's
  code.
