# WP33: Hosting a real program — what the compiler owes the cs port

**Proposed. Nothing here is built.** This note is the compiler's half of a plan
whose other half lives in the program being ported:
[`amritk/cs` → `docs/nish-port.md`](https://github.com/amritk/cs/blob/main/docs/nish-port.md).
That document owns the order of the whole port, the lanes that rewrite the game,
and the cutovers that swap a runtime under it. This one owns the items that only
this repository can build, each written so that an agent can take it without
reading the rest. [LANGUAGE.md](LANGUAGE.md) stays normative; where this note and
LANGUAGE.md disagree, LANGUAGE.md wins, and an item that changes the language
lands its rule there in the same pull request.

## 1. Why a program, and why this one

Every language decision since WP14 has been argued against one real program:
this compiler. That was the right corpus for a compiler — string scanning, trees,
tables, a file in and a file out — and it has left the language fitted to that
shape. It has no clock but a monotonic one, no socket, no way to be driven by a
host that owns the loop, and no answer for a process that allocates for an hour
and must not grow.

`cs` is a browser arena shooter and its servers, all TypeScript: a deterministic
simulation shared bit for bit between browser and server, a byte-level wire
protocol, a netcode host and a predicted client that are pure state machines, a
WebGPU and WebGL 2 renderer, synthesised sound, a game server, a supervisor that
starts game servers, an account service and a Rust WebTransport relay. Its owner
wants all of it in Nish eventually. That makes it the second corpus, and a
better one for the half of the language nobody has had to write yet: long-lived
processes, float-heavy determinism, a host-owned frame loop, and the network.

The rule for this note is the rule WP15 used for speed: **an item is here
because a named part of cs cannot be written without it, and it is not here
otherwise.** Everything cs can express by rewriting its own TypeScript into the
strict subset, it rewrites — the cs note's §4 is that idiom table. What remains
is the list below.

## 2. What was measured

On 2026-09-28, the released `nish 0.12.0` (`bash scripts/fetch-seed.sh`) was run
over every non-test source file in cs with `--number-mode f64 --json`. **No file
got past the parser.** The first refusal in each file was, in order of
frequency: an inline `type` modifier on an import specifier
(`import { type Vec3, clamp }`), `as const`, a module constant that is an arrow
with default parameters, `override` on an `Error` subclass, a regex literal, a
`readonly` tuple type, a mapped type, a string-literal union, and `?.`/`??`.
Every one of those is on the cs side of the line in §1: the rewrite is local and
the construct buys the game nothing. So the parse wall says nothing about this
note's list — which is the point of taking the measurement first. What the
list is instead comes from reading what cs *does*, below the syntax.

Two facts from that reading shape every item:

- **cs is float64 everywhere it matters.** `packages/sim` keeps position,
  velocity and the world's bounds in `f64` and forbids `f32` in the owning
  player's state; its angles go through a 16-bit turn and a lookup table
  precisely because `Math.sin` is implementation-defined. So cs compiles under
  `--number-mode f64`, and the integer work it does (hashing, quantising,
  packing) is done in explicit `u32`/`i32`/`u16`/`u8`.
- **cs needs its code to mean the same thing under V8 and natively, for the
  whole length of the port.** The browser runs the simulation in JavaScript
  until the client is cut over, and the server will run it natively before
  then. Prediction corrects by exactly zero on a clean link only if both agree
  to the bit. [RUN_UNDER_NODE.md](RUN_UNDER_NODE.md) states where the prelude's
  overlap ends; N4 turns that statement into a check.

## 3. The items

Sizes as in [MASTER_PLAN.md](MASTER_PLAN.md) §5: S under a day of agent work, M
one to two days, L several. **Lane** names the part of the compiler an item
edits, because two items in one lane conflict: the checker lane takes at most
two items in flight (MASTER_PLAN's WP-P rule about `checker.ts` hot spots).
**Unblocks** names the cs lane or cutover waiting on it (the cs note's §6 and
§7). Every item ships with the construct checklist of
[ARCHITECTURE.md](ARCHITECTURE.md), a line in the changelog through its commit,
and — because cs consumes only released compilers, the way `src/` consumes only
the seed — **a release before cs can use it.** The Release PR stays a human's
merge; §5 says when one is worth cutting.

### N1. Exported enums and type aliases (S–M, checker lane)

An enum and a type alias cannot be exported today (LANGUAGE.md §Enums, §Type
aliases), so an enum cannot appear in a cross-module API. cs has two real
enums and nineteen `const X = {…} as const` pseudo-enums — the match phase, the
game mode, the material, the message types, the fidelity tier — and every one
of them is read in a module other than the one that declares it. Rewriting a
pseudo-enum into an `enum` is cs's job; letting that enum cross a module
boundary is this item. An alias crosses with it, because the rewrite of a
mapped type (`Mutable<MoveConfig>`) is a named interface and the rewrite of a
string-literal union is an enum, and both are named where they are used.

Acceptance: an enum declared in one module, exported, imported by name into a
second, used as a field type, a parameter type, a `switch` discriminant and a
`Map` key there; the same for an alias of a class, an array and a `T | null`.
The negative tests keep the rules that stay: no string enums, no `const enum`,
no default export.

Unblocks: C1 (sim), C2 (protocol), every package after them.

### N2. Math, bits and JavaScript's rounding (S–M, builtins lane)

`Math` has `sqrt floor ceil trunc round sin cos exp log pow abs min max random`
(LANGUAGE.md §Builtins). cs also uses `atan2`, `tan`, `asin`, `acos`, `atan`,
`hypot`, `sign`, `log2` (the bots, the figure, the camera), `clz32` (the
world's occupancy bitset) and `imul`. And it depends on two meanings that differ
from JavaScript's today:

- **The sign of zero.** `Math.round` already rounds half toward +∞, but
  `Math.round(-0.3)` is `+0` here and `-0` in JavaScript (LANGUAGE.md
  §Semantics decisions), and `Math.min`/`Math.max` may return either zero for
  `(0, -0)`. cs writes the owning player's state to the wire as raw `f64`, so a
  zero's sign is a byte on the wire, and its simulation already normalises
  `-0` by hand where it knows one can arise (`SIN_TABLE[i] = value + 0`). A
  native server that disagrees with the browser about a zero's sign sends a
  snapshot the browser did not predict.
- **A float's bits.** cs's byte cursors write `f32` and `f64` with a
  `DataView`. `f64ToBits`/`bitsToF64` exist; the `f32` pair does not.

The item adds the missing functions as intrinsics or libm calls, makes
`Math.round`, `Math.min` and `Math.max` answer JavaScript's zero and NaN (each
is a documented deviation today, so this withdraws a deviation, which the
stability rule allows before 1.0 — the item measures what `minnum` to a
sign-aware select costs and records it), adds `f32ToBits`/`bitsToF32`, and makes
every one of them available to a freestanding `wasm` build, which links no libm
today. The transcendental
functions are the ones whose last bit may differ from V8's; the item documents
that, and cs keeps them out of the shared simulation by rule (its determinism
test already bans them there).

Acceptance: each function against Node over a sweep that includes ±0, ±∞, NaN,
the halfway points and the subnormals, on the native and the `wasm` profiles,
through the differential harness.

Unblocks: C1, C5 (netcode's bots), C9 (the client's pure modules).

### N3. A wall clock and entropy (S, runtime-os lane)

`monotonicNanos()` is the only clock (LANGUAGE.md §Clock) and `Math.random` the
only randomness, unseedable and non-cryptographic. cs signs tokens with an
expiry (`Date.now()` against a TTL), mints resume tokens and room slugs from
`crypto.getRandomValues`, and stamps match reports. Add `Date.now(): f64` (Unix
milliseconds, as JavaScript) and `crypto.getRandomValues(bytes: u8[]): void`
(`getrandom` natively, a host import on `wasm` — which is N8's mechanism, so the
`wasm` half lands with or after N8).

`runtime-os.c` is at 1,190 of its 1,280 bytes (MASTER_PLAN §2). Measure both
additions before arguing about where they go; if they do not fit, the precedent
is the split that created `runtime-os.c`, not a raised ceiling.

Unblocks: C2's tokens, C5's resume tokens, X3.

### N4. The overlap check (M, validator and checker lane, plus `runtime/nish.mjs`)

This is the item the whole port leans on, and the one most likely to be
underestimated.

cs is ported *in place*: a package is rewritten into the strict subset while it
is still TypeScript, still built by Vite and Bun and still tested by
`node:test`, and it is cut over to a Nish binary later, at a seam, when the
parts around it are ready (the cs note's §3). In between — for months, for
some packages — the same source runs in two meanings: V8's, with
`runtime/nish.mjs` supplying the globals, and the compiler's. Where they differ,
a browser predicts one thing and a native server simulates another.
[RUN_UNDER_NODE.md](RUN_UNDER_NODE.md) §"What stays divergent" is the list:
integer-typed arithmetic (a `u32` multiply is a wrapping multiply natively and
a float multiply under V8), `i64`, string offsets that are UTF-8 natively and
UTF-16 under V8, and `toI32`'s saturation against `ToInt32`'s wrap. (The
zero and `NaN` deviations of `Math` are N2's to remove rather than this item's
to refuse.)

A list in a document is not a guard. The item is a flag, `--overlap`, under
which the checker refuses every construct whose meaning differs between the two,
with a diagnostic that names the portable spelling, and a prelude grown with the
builtins that make the portable spelling exact on both sides:

- `imul(a: i32, b: i32): i32`, `wrapU32(x: f64): u32` and `wrapI32(x: f64): i32`
  with `ToUint32`/`ToInt32` meaning, which are what cs's hash (`mixSeed`) and
  PRNG (`seededRandom`) need in order to be written without a `u32` operator;
- a `u32` or `i32` value's arithmetic operators refused under `--overlap`
  unless the result is immediately wrapped by one of those, so no expression
  can mean two things;
- `i64`/`u64` refused under `--overlap`;
- `string.length` and the offset-taking string methods refused on a string the
  checker cannot prove is ASCII, or refused outright if that proof is too
  expensive — the item decides and documents which.

The erasure rule of [wp28](wp28-compatibility-mode.md) §1 applies in reverse:
`--overlap` only ever *narrows*, and a program that passes it emits
byte-identical IR without it.

Acceptance: every `tests/differential/` program that passes `--overlap` agrees
with Node through the prelude alone, without the rewriter — that is what the
flag claims, so that is what is tested. Plus a `reject_overlap_*` case per
refusal.

Unblocks: the cs ratchet (C0) runs with `--overlap` from the day this ships;
until then C1 and C2 are held to cs's own determinism goldens instead.

### N5. `std/crypto` and `std/bytes` (M, std only — parallel-safe)

Pure Nish, no compiler change: SHA-256, SHA-1 (the WebSocket handshake needs it
and nothing else may), HMAC-SHA-256, a constant-time equality, base64 and
base64url, and UTF-8 conversion between `string` and `u8[]`. cs signs relay
grants, identity grants and match reports with HMAC-SHA-256 today, through
`node:crypto` on the server and Web Crypto (which is asynchronous) in the relay
grant, and the Rust relay verifies the same format; all three must agree on the
bytes.

Acceptance: the NIST and RFC 4231 vectors, and the relay's own fixtures
(`services/relay/src/grant.rs` tests) reproduced byte for byte.

Unblocks: C2, X3, and the relay and API cutovers eventually.

### N6. `std` growth: sort, number formatting, split (S–M, std only)

`sort` is already [wp26](wp26-stdlib.md) §7's next candidate; cs sorts
scoreboards, placements and draw orders. `toFixed(n)` and a formatting of `f64`
that is JavaScript's `String(x)` byte for byte are what cs's shader generators
need, because the WGSL and GLSL sources are built from the palette with
template literals and `toFixed(3)`, and a parity suite compares the two texts.
`split` on a separator, because the option parsers and the cookie reader are
written with it.

Unblocks: C9, C11, C7's option parser.

### N7. Typed JSON (M, std first)

cs's token payloads, its match report, the master's `/matches` census and every
account-service body are JSON with a declared shape. `JSON.parse` into an
undeclared shape is Tier 3 and refused forever ([wp28](wp28-compatibility-mode.md)
§2.2); parsing into a declared interface is not. Start with a tokenizer and a
writer in `std/json` that a hand-written codec per shape can sit on — cs has
few enough shapes that this is a day's work for it — and derive codecs in the
compiler only if the hand-written ones turn out to be where the bugs are.

Unblocks: C2's tokens, X3's results POST, X6, X7.

### N8. Host imports on `wasm` (L, interop lane) — design note first

**The client cannot be cut over without this, and nothing is designed.** A
freestanding `wasm` build links with `-nostdlib --export-all` and no
`--allow-undefined` (`scripts/build.sh`), and nothing in `src/` emits an
`import_module`/`import_name`. So a Nish module in a browser can be *called*,
but cannot call WebGPU, WebGL 2, WebAudio, the DOM, `WebTransport` or even
`console.log`.

The design follows WP27 rather than inventing a second foreign-function
mechanism: a `declare function` in a program built for `wasm` becomes a wasm
import instead of an LLVM `declare` resolved by the linker, with the import's
module named by a convention the note decides (a `declare function` inside a
`.ts` file under a `host/` path; or an import from a `host:<module>`
specifier; or an attribute-free naming rule — the note weighs them against
`tsc --strict`, which every spelling must pass). What crosses:

- scalars, as WP27 S1;
- an opaque host handle as an `i32` index into a table the loader keeps (the
  `externref` alternative is measured and decided in the note), because a
  `GPUDevice` or an `AudioContext` has to be named from Nish without being
  touched;
- `u8[]`, `f32[]`, `f64[]` and `string` as a pointer and a length into linear
  memory, **without a copy** — the instance upload is tens of kilobytes a
  frame, and wp8's copy-in, copy-out marshalling would pay for it twice.

`--emit-dts` grows the other half: the loader takes an `imports` object typed
from the declarations, so the host glue is checked by `tsc` against the Nish
source rather than kept in step by hand. The freestanding runtime grows
`console` and `Math.random` over the same mechanism.

Acceptance: a Nish program on the `wasm` profile that creates a WebGL 2
context, uploads an `f32[]` and draws a triangle in headless Chromium, and
another that plays a synthesised buffer through WebAudio; both with the glue
generated rather than written.

Unblocks: X4, X5 — the whole client.

### N9. Programs that do not exit (L, memory lane) — design note first

A Nish program today either runs to the end of `main` or is a library whose
every exported call is bracketed by `nish_arena_mark`/`nish_arena_release` in
the loader (wp8). cs needs the two shapes in between, and they share one
question — how memory is reclaimed in a process that lives for hours — so they
are one note with two halves:

- **N9a, host-driven.** The browser owns the frame loop (`requestAnimationFrame`)
  and the page owns the socket callbacks, so the client core is called, not
  calling: `step(now, input…)`, `receive(bytes)`, `frame(out)`. Its state must
  outlive each call. The item lets an export return an instance as an opaque
  handle and later exports take it back, and gives such a module a loader that
  does not release the arena under the state.
- **N9b, steady state.** A game server runs matches back to back for as long as
  the box is up, and the arena never frees an object. The netcode host
  allocates a snapshot per client per tick today. cs's side is to make every
  tick allocation-free in steady state — it already measures bytes per
  operation (`bun run bench`), and pools and out-parameters are its house
  style. This side is what remains when that is done: something that is
  allocated once per *match* (names, the map, per-player histories) and must be
  reclaimed at the end of one. The note weighs an explicit region value against
  a scope keyed to a block (`using m = region()`), against making
  `Arena.reset` safe by construction for a struct the program rebuilds, and
  against reference counting for the few objects that genuinely outlive a
  match, which [MASTER_PLAN](MASTER_PLAN.md) §1 promised and never built.

Acceptance, measured rather than argued: the ported netcode host run for a
million ticks with sixteen players and a thousand matches back to back, with
`Arena.used()` flat after the first match; and the client core driven for an
hour of frames on the `wasm` profile with `memory.buffer.byteLength` flat.

Unblocks: X3 (N9b), X4 (N9a).

### N10. Sockets and the loop a program owns (L, runtime lane)

[wp24](wp24-async.md) §2 found nothing to wait for in either runtime, and that
is still true. It also named the trigger for revisiting — "a real server" —
and this is one. The recommendation here keeps wp24's refusal: **no `async`,
and no event loop in the runtime.** The game server is already a fixed-rate
loop (64 Hz, `services/game/src/clock.ts`), and the honest shape for it is a
program that owns its loop and blocks in `poll` until the next tick or the next
packet, whichever is sooner.

So the item is small primitives, not a framework: non-blocking UDP
(`bind`, `sendTo`, `recvFrom` into a caller's `u8[]`), non-blocking TCP
(`listen`, `accept`, `read`, `write`, `close`), and `poll(fds: i32[], events:
u8[], timeoutMs: i32): i32`. A handle is an `i32` descriptor. Where the code
goes is the runtime-budget question again: measure, and split into a
`runtime-net.c` with its own ceiling if it does not fit, which is the precedent.

`wasm` is out of scope: a browser reaches the network through N8's imports.

Acceptance: a UDP echo and a TCP echo written in Nish, driven by a Node client
in `tests/`, and a two-socket `poll` that wakes on whichever is readable first.

Unblocks: X3, X6.

### N11. `std/http` and `std/websocket` (M–L, std only, over N10 and N5)

The game server answers `GET /` and `/connect` and upgrades `/play` to a
WebSocket; the master serves `/connect` and `/matches` and polls its children
over HTTP. Both are HTTP/1.1 behind Caddy, which terminates TLS, so neither
needs TLS in-process. The item is a request parser and a response writer that
work on a caller's buffers without allocating per request, the RFC 6455
handshake and framing (server side, and client side for the master's
polling), and nothing more: no router, no middleware.

Acceptance: `curl` and a Node `WebSocket` against a Nish echo server in
`tests/`; the Autobahn fuzzing suite's server cases if it can run in CI.

Unblocks: X3, X6.

### N12. Processes for a supervisor (S–M, runtime-os lane)

The master spawns game servers, signals them and reaps them.
`spawnSync` exists; the item adds a non-blocking `spawn` answering a pid, a
`kill(pid, signal)`, a `waitpid` that does not block, and the two machine facts
the master sizes its pool from (available parallelism, total memory).

Unblocks: X6.

### N13. WP27 S3 to S5, and a callback (L, FFI lane)

Late, and only if the owner decides the relay and the account service are in
scope in Nish (the cs note's decision D3). WebTransport is QUIC and HTTP/3 over
TLS 1.3; Postgres wants TLS and SCRAM; Resend is HTTPS. Writing those in Nish
is not this language's job, and a C library through FFI is the realistic route
— which needs [wp27](wp27-ffi.md)'s strings (S3) and structs (S4), and a C
library that calls back into Nish, which no stage of WP27 covers yet: a pointer
to a top-level function, since a function is not a value (LANGUAGE.md §Arrow
functions). wp27 §3's last paragraph — whether raw pointers are welcome at all
— has to be answered first, and this item is the reason to answer it.

Unblocks: X7, X8.

### N14. Discriminated unions (L, checker lane) — optional

Deferred in [wp18](wp18-generics.md) §7 with its trigger unmet. cs's protocol
decodes two message families with a `switch` on a tag, and its synthesiser has
many voice variants. It does not *need* the construct: the strict spelling —
a class with an enum tag and a nullable payload field per variant — is what cs
will write in the meantime. The item is worth building when that spelling is
measurably worse (a padded struct per message, or a bug a `switch` would have
caught), and cs's port is the program that will say so.

## 4. Not in the list, on purpose

- **`async`/`await`.** N10 is the answer for a server and N9a for a browser;
  wp24's refusal stands.
- **Closures and stored callbacks.** cs stores a clock and a random source in
  fields to make them injectable in tests. The strict rewrite passes the time
  and the random state in as values, which is more deterministic, not less.
  wp28's C2b stays where it is.
- **Inheritance and virtual dispatch.** cs has three real hierarchies (a game
  mode, a transport, a renderer backend); each becomes a tag and a `switch`.
  wp25 stands.
- **`i8`/`i16`.** cs's wire format packs signed 16-bit positions; a `u16` and a
  sign extension write it. Add the types only if the port measures the
  workaround.
- **Compatibility mode.** [wp28](wp28-compatibility-mode.md) would let cs compile
  sooner and prove less. The port is small enough to rewrite, and strict is
  what makes a native server that agrees with a browser to the bit believable.

## 5. Order, and when to cut a release

| Wave | Items | Why then |
| --- | --- | --- |
| 1 | N1, N2, N3, N5, N6; the N8 and N9 design notes | what cs's first lanes (sim, protocol) stop on, plus the two notes that gate everything after |
| 2 | N4, N7, N10, N8 build | the overlap check before the ratchet is trusted; the network before the first server cutover |
| 3 | N9 build, N11, N12 | the first native game server (cs X3) and the first client core in `wasm` (cs X4) |
| 4 | N13, N14 | only on the owner's decision |

Checker-lane items (N1, N4, N14) are serial with each other; everything else in
a wave is disjoint by file. **Cut a release when an item a cs lane is waiting on
has landed** — the lane cannot start until then, the way `src/` cannot use a
construct until the seed has it. N1 and N2 together are the first such release.

## 6. What this note does not decide

The cs-side order, the cutovers and their gates, and the owner's decisions on
scope (the relay, the account service, where it runs) are
[the cs note's](https://github.com/amritk/cs/blob/main/docs/nish-port.md). The
spelling of a host import, the handle representation, and the memory model for
programs that do not exit are N8's and N9's own notes, which this one only
scopes.
