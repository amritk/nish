# Security record: the wasm-host boundary — module storage, windows, panics and `nish/page`

The record of WP50 stage 3 (`docs/wp50-wasm-host.md` §5, §6, §11, §12): the
boundary between a module built with `--profile wasm-host` and the page that
loads it. It covers the panic import, the generated loader's guard around
every export, the buffer windows a host import is lent, the ring the page and
the program share in module storage, and the page-side handle table. It says
what each side may hand the other, what is refused, and the test that pins
each property. It is written against `91f5d8b8` in PR #1273, and its lines are
cited there.

**Result.** The module reads nothing the page names outside the memory it
owns, and a page that calls back into a module mid-call or after a panic is
refused before the module runs.

There are seven findings, all fixed by the stage that found them:

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

## Scope

| File | Functions |
| --- | --- |
| `runtime/page.mjs`, `runtime/page.d.ts` | `HostTable` (`add`, `get`, `take`, `#check`), `ringOver`, `reportPanic` |
| `std/host/ring.ts` | `ringCapacity`, `ringCount`, `ringSize`, `ringFree`, `ringPush`, `ringShift`, `ringClear` |
| `runtime/runtime-wasm.c` | the `nish.panic` import (`nish_host_panic`, `NISH_DIE`) under `NISH_WASM_HOST` |
| `src/interop-wasm.ts` | the generated loader: `panicText`, `panicOf`, `guardLoader` (`guarded`), `payloadIn`, `resultIn`, `arrayIn`, `hostImportsOf` (`hostFn`, `win`), `pushHostEntry`, and `layoutLoader` (`layout`, `views()`) |
| `src/emit-strings.ts` | `emitHostWindow`: a window's bound in the module |
| `src/attributes.ts` | `hostWindowProven`: when a window's bound is proven and the check is left out |

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
| WH-3 | Medium | `src/interop-wasm.ts:891`–`:907` (`panicOf`), `:925`–`:972` (`guardLoader`) | A host import can call an export while the module's call is still on the stack, and the inner call runs on half-changed state. The `onPanic` reporter can too, and its call runs on the state the panic interrupted. | **Fixed.** Every export of a program with module storage or a host module runs in `guarded`, which refuses a busy module with `NishReentry` and a dead one with `NishPanic`, both before the module is touched (a program with neither has no import to call back through and keeps the unguarded loader, §6 of docs/wp50-wasm-host.md); `panicOf` marks the module dead before it calls the reporter, so a reporter that calls back in gets `NishPanic`; a trap, a re-entry or an exception escaping a call kills it, tagged `trap`, `reentry` or `exception` ("panic: an import that calls back into an export throws NishReentry, and the inner call never ran", "panic: panic(message) carries the program's words, and a reporter that calls back in gets NishPanic", "panic: a dead module answers every later call with NishPanic, before it runs", "panic: an exception escaping a host import kills the module"). |
| WH-4 | Medium | `runtime/page.mjs:20`–`:65` (`HostTable#check`) | The check refused a taken slot with `this.#free.includes(handle)`, O(free) per call: 200,000 gets beside 200,000 taken slots is 4·10¹⁰ comparisons, enough to stall a page that frees what an attacker had it allocate. | **Fixed.** A taken slot holds a private `EMPTY` symbol and the check reads the slot ("page: HostTable's check reads the slot, not the free list: 400,000 gets beside 200,000 taken slots take under a second"). |
| WH-5 | Low | `src/interop-wasm.ts:865`–`:886` (`panicText`) | `panic(message)` hands the loader `(msg, len)`. Read as `new Uint8Array(buffer, msg, len)`, a pair outside memory throws a `RangeError` from inside the panic path, and one whose sum wraps is read from the wrong place. Only the module calls the import, so this is hardening. | **Fixed.** Both are read as `u32` and held against the buffer's size without adding them; a message outside memory reads as "panic (its message is outside memory)" ("panic: a panic message the module places past the end of memory, or wrapping it, is not read"). |
| WH-6 | Low | `runtime/page.mjs:20`–`:65` (`HostTable`) | A handle the program forged, 0, a fraction or a taken slot read as `undefined`, which a host function would pass on. | **Fixed.** `#check` throws a `RangeError` for each, which inside an import kills the module (WH-3), and slot 0 is never handed out ("page: HostTable hands out 1 and up, never 0, reuses a taken slot, and throws on a taken, zero, forged or fractional handle"). A stale handle kept after `take` names the newer object once its slot is reused: the program is trusted (threat model), so that is its bug, not a win, and the table carries no generation count. |
| WH-7 | Low | `src/interop-wasm.ts:729`–`:735` (`payloadIn`), `:736`–`:763` (`resultIn`), `:1075`–`:1101` (`arrayIn`) | Only a number of the wrong type was refused before the module ran. A malformed `Result`, a payload of the wrong JavaScript type, or a Proxy, re-prototyped `DataView` or detached buffer passed as a typed array threw from inside `guarded`, which then marked the module dead: one bad call from the page ended it for good. | **Fixed.** Every argument is checked before the call: a `Result` must be an object whose `ok` is a boolean and whose payload has its arm's JavaScript type, read once through a `try` so a throwing getter is the caller's error; an array must pass the `%TypedArray%` brand getter and is measured with the `length` getter, neither of which runs caller code. Each refusal is a `TypeError` tagged so `guarded` lets it through and the module stays alive ("panic: an argument of the wrong JavaScript type is a TypeError before the module runs, which stays alive", whose lines include a BigInt given to an `i32`; "panic: a Result payload or an array of the wrong shape is a TypeError before the module runs, which stays alive"). |

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

**Storage holds what the module wrote, not what its type says.** The page
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
