# WP26: Sockets, the reactor, and what a server needs first

**Proposed, not implemented.** This note is the package
[wp24-async.md](wp24-async.md) §6 called **A2** and left unowned, with the
sentence "nobody has asked". Someone has asked: Nish is to be used for
servers. A2 was the load-bearing link in that chain, so it now has a note, and
WP24 stops being a refusal and becomes a plan with this package in front of it.

[LANGUAGE.md](LANGUAGE.md) is normative and nothing here changes a line of it
yet. `async`, `await` and `yield` stay forbidden with the messages they have
until S3 below actually lands; where this note and LANGUAGE.md ever disagree,
LANGUAGE.md wins.

Read [wp24-async.md](wp24-async.md) §2 to §4 first. That analysis is unchanged
and it is this note's cost list: what a suspend point does to the attribute
fixpoint, to the arena, to the wasm twin and to the differential oracle is the
same whether or not anyone wants a server. What the server changes is the
*answer*, not the arithmetic.

## 1. The decision

**Build the I/O surface first and the syntax last, in four stages, and make
the first stage ship a server that runs.**

| | Stage | Language surface | What it delivers |
| ---: | --- | --- | --- |
| **S1** | Blocking sockets, on WP20 T1 threads | **none** — builtins only | a thread-per-connection server, in the language as it is today |
| **S2** | The reactor: non-blocking mode, a poller, timers | **none** — builtins only | one thread watching many connections, with the state machine written by hand |
| **S3** | `async` / `await` over S2 | the whole of WP24 A3 | the same program, without the hand-written state machine |
| **S4** | Futures as data — an array of them, `join`, `select` | WP24 A4 | a work queue, after WP18 |

Three things about that order, because the order is the decision:

1. **S1 needs no language change at all.** Sockets are builtins, the same
   shape as `readFileSync` and `spawnSync`, and a thread per connection is
   WP20 T1 with the caveat §3.2 below found. A Nish server is reachable
   without `async` existing, and reaching it first is what turns every later
   stage's argument from a prediction into a measurement.
2. **S2 is where the hard parts actually are**, and it has no syntax in it.
   The poller, the timer heap, the readiness model, the budget, the wasm
   split, and the Node twin are all S2 problems. A project that starts at S3
   pays for all of them anyway and finds out later.
3. **S3 has to beat S2 on a number.** `async`/`await` over a reactor is
   ergonomics — the reactor is already expressible as a `while` loop over a
   `switch`, which is how C does it. That is a real feature and a real cost
   (§4 of WP24 is the cost, itemised), and the project's own rule is that a
   claim is a measurement. The acceptance test for S3 is in §4.

**What this note does not do is promise a schedule.** Every stage below is
sized, gated, and has an acceptance test; none of them is dated, and §6 names
the two things that should land before any of it — neither of which is in the
stages — and the ordering fact that makes the whole road cheaper after M4 and
M6 than before them.

## 2. What a server needs that this language does not have

The whole I/O surface today, from LANGUAGE.md, is seven calls — `readFileSync`,
`readFileSyncOrNull`, `writeFileSync`, `appendFileSync`, `mkdirSync`,
`isDirectorySync`, `spawnSync` — plus `getenv`, `console.*` and `process.exit`.
Against what a TCP server needs:

| Need | Today | Stage |
| --- | --- | --- |
| listen on a port | nothing | S1 |
| accept a connection | nothing | S1 |
| read bytes from a connection | nothing | S1 |
| write bytes to a connection | nothing | S1 |
| close a connection | nothing | S1 |
| a connection's peer address | nothing | S1 |
| a second connection served at the same time | WP20 T1 (unbuilt), or nothing | S1 |
| set a socket non-blocking | nothing | S2 |
| wait for readiness on many fds | nothing — no `poll`, `epoll` or `kqueue` anywhere in the tree | S2 |
| a timeout | nothing — no clock, no timer, no `sleep`. `runtime/nish.h` exports no time function of any kind | S2 |
| parse a request | `charCodeAt`, `substring`, `String.fromCharCode` — a byte loop, which is what `self/lexer.ts` already is at 187,176 tokens over 640 files | **have it** |
| an error that is not an exception | `Result<T, E>` (WP16, WP17) | **have it** |
| per-request memory that frees in O(1) | the arena, and `nish_reset_arena` already exists for exactly this on the N-API path | **have it** |
| TLS | nothing, and §7 declines it | — |

The last three rows are why this is worth doing rather than daunting: the
parts of a server that are usually the awkward fit for a systems language —
the parser, the error channel, the per-request allocator — are the parts this
language is already shaped for. What is missing is the syscalls.

## 3. Four measured facts that change the shape of the plan

Measured on this tree, today, because three of the four contradict a number
some other note is still costing its plan against.

### 3.1 The runtime budget is spent: 4,088 of 4,096, not 2,544

MASTER_PLAN §2 sets a hard budget of 4 KB of `.text` for `runtime.c` at `-Oz`
and gives the command. Run it:

```
$ clang -Oz -c runtime/runtime.c -o rt.o && size -A rt.o
.text              4088      0
.text.unlikely.      66      0
.rodata            9920      0
```

**4,088 of 4,096 — eight bytes of headroom**, and 4,154 if the cold section
counts. Three notes were costing their plans against three different numbers,
all of them stale: MASTER_PLAN §2 said 2,544, MASTER_PLAN §4 said 3,852, and
[wp20-threads.md](wp20-threads.md) §3.5 said 2,544 and then reasoned about "the
remaining 1,552 bytes" — of which there are none. All four sites are corrected
in the change that adds this note, and WP24 §4.5's "a poller, a timer heap and
a ready queue are not 244 bytes" turns out to have been right by a much larger
margin than it knew.

This does not block anything, because the budget rule is already the wrong
measurement and says so in its own body: `-ffunction-sections
-Wl,--gc-sections` means a binary pays only for what it calls, which is why
adding `nish_mkdir` and `nish_spawn` left `examples/hello.ts` at the same byte
count. Measured today, that still holds: `examples/hello.ts` links to **4,680
bytes** at the `size` profile against a `runtime.c` whose `.text` is 4,088.
The object file is not what ships.

**So the budget rule has to be restated before S1, not after.** The honest
rule is a per-program linked size — `examples/hello.ts` stays at its byte
count, a program that opens no socket links no socket code — and that is an
acceptance test rather than a wish. Restating it is a MASTER_PLAN §2 edit and
a CI check, it is a prerequisite for WP20 T1 just as much as for this package,
and it is the cheapest item in this note.

### 3.2 The accept loop does not fit WP20 T1's structured join

This is the finding that most changes another package's plan.

WP20 T1 requires that "every handle is joined on every path of the frame that
spawned it", and that "a handle is not storable in a field, an element or an
array in this stage". A server's inner loop is:

```ts
while (true) {
  const conn = accept(listener);
  Thread.spawn(serve, conn);   // never joined — the loop does not end
}
```

Every clause of T1 refuses this. The handle is not joined; the frame does not
end; the number of spawns is not statically known. **A thread-per-connection
server is not expressible under T1 as specified**, and T1 is the only stage
WP20 proposes to build first. §3.4 of that note defers detached threads
explicitly, and detaching needs an owned transfer — a copy into the receiver's
arena, or opt-in atomic refcounting, which MASTER_PLAN §3.4 already carries as
an open decision.

The way out does not need detached threads, and it is worth stating because
it is what S1 will actually do:

```ts
export function main(): i32 {
  const listener = listen(8080);
  const w0 = Thread.spawn(worker, listener);   // each worker loops on accept
  const w1 = Thread.spawn(worker, listener);
  const w2 = Thread.spawn(worker, listener);
  const w3 = Thread.spawn(worker, listener);
  return w0.join() | w1.join() | w2.join() | w3.join();
}
```

A **fixed pool, spawned in `main` and joined on `main`'s only exit path**, with
each worker looping on `accept` over a shared listener. That satisfies T1
exactly as written: the handles are named, they live in the spawning frame,
and every path joins them. It costs one source line per worker and a
recompile to change the pool size, which is ugly and which is *sound today*.

Two consequences:

- **T1 is enough for S1, and only just.** The pool size being a source
  constant is the price, and `Thread[]` — a handle array with a joined-on-every-
  path proof over the array — is the smallest thing that removes it. That is a
  new stage for WP20 to own, somewhere between T1 and T3, and this note is its
  first customer rather than its author.
- **Accepting on one listener from several threads is a real design choice**,
  not a detail: a shared blocking `accept` (the thundering-herd-free kernel
  behaviour on modern Linux) versus `SO_REUSEPORT` with a listener per worker.
  It is measurable, so §4 measures it rather than this section deciding it.

### 3.3 There is no Node twin for a blocking `accept`, and WP13 is a premise

Every builtin in the language has a JavaScript twin in `runtime/shim.mjs` —
`mkdirSync`, `getenv` and `spawnSync` included — because
[wp13-differential.md](wp13-differential.md) rewrites each corpus program to
JavaScript and compares it against Node byte for byte, stdout, exit status and
signal. That is not a nice-to-have; it is how this project knows its semantics
are the ones users assume.

**Node has no synchronous socket read.** `node:net` is callback- and
stream-shaped all the way down, and there is no `net.acceptSync`. So a
blocking `recv(fd): string` cannot be shimmed the way `readFileSync` is, and
the honest options are three:

1. **Shim it over a worker thread** — `Atomics.wait` against a
   `worker_threads` worker doing the real socket work. This is how
   `child_process.execSync` gets its synchrony, it is genuinely possible, and
   it is a real piece of engineering in `shim.mjs` rather than a ten-line
   twin.
2. **Declare the socket builtins out of the differential corpus**, with the
   reason written in `known-failures.txt`. This is cheap and it is the kind of
   by-design entry [wp25-inheritance.md](wp25-inheritance.md) was pleased to
   *delete*. The file holds ten entries in three categories today — three
   floating-point differences, five from checked integer division, and two
   programs that print raw arena byte counts the Node shim cannot know — and
   **every one of them is a single program**. An entry that excuses an entire
   subsystem is a different order of thing, and it should be written as a
   scope decision if it is taken at all, not filed as ten more lines beside
   `f64_libm`.
3. **Test sockets outside the differential harness**, with a native-only
   integration test: start the server, drive it with a Node client, compare
   the responses. This proves the server works and proves nothing about
   agreeing with Node's semantics — which, for a socket API that is deliberately
   *not* Node's, may be the correct scope.

**The recommendation is 3 for S1 and S2, with 1 revisited if and when a
program wants to mix sockets and the corpus.** What matters is that the choice
is made in writing before the first builtin lands, because the differential
suite's value comes from being total over the corpus, and an unstated hole in
it is worse than a stated one.

### 3.4 The arena is already the right memory model for a request, and that is the strongest fact here

A request handler allocates: a read buffer, the parsed pieces, the response.
Then the request ends and all of it is garbage at once. That is precisely the
shape a bump allocator with scopes is best at, and this runtime already has
one — `nish_arena_mark` / `release` / `keep` (WP6), with `nish_reset_arena`
already exported and already used for exactly this purpose on the N-API path
(`src/interop/napi.ts` generates `nish_napi_reset_arena`).

So the per-request memory model is: **an arena scope per connection, or per
request, reset in O(1) at the end of it.** No free list, no GC pause, no
per-object bookkeeping — the thing every arena-per-request server framework in
C and Zig is hand-rolling, available as the language's default allocator.

Two things follow for the API design, and both go the same way:

- **`recv` should return a `string`, not a `u8[]`.** `readFileSync` already
  returns "the whole file as one arena string", and `charCodeAt` reads bytes
  out of a string with a bounds check and a `load i8`. A `u8[]` buffer would
  be a second, parallel byte-sequence type with no reasonable way back to
  `string`: there is no `Uint8Array` alias and no bytes-to-string builtin
  (LANGUAGE.md, "Typed-array names are aliases, not views"), so the only route
  is `String.fromCharCode` per byte and concatenation — which is quadratic, and
  which the compiler already emits a `performance` warning for by name
  (`tests/cases/perf_str_concat_loop`). A language that warns about a loop is
  not one to design an API around. One allocation per read, into an arena that
  is about to be reset, is the cheap side of that trade.
- **[wp15-performance.md](wp15-performance.md) §4's fast slice (WP15 item 5)
  is worth more than its position suggests**, because an HTTP parser is
  `substring` in a loop and `substring` is one allocation and one `memcpy`
  each time. A server is the program that makes item 5 pay for itself, and it
  is already the next unbuilt item on the WP15 list.

## 4. The stages, with what each one has to prove

### S1 — Blocking sockets, and a server that runs

**Surface.** Builtins in the shape LANGUAGE.md already uses for I/O, returning
`Result` where they can fail, which is all of them:

```ts
listen(port: i32, backlog: i32): Result<i32, i32>   // an fd, or errno
accept(listener: i32): Result<i32, i32>
recv(fd: i32, max: i32): Result<string, i32>        // "" at end of stream
send(fd: i32, data: string): Result<i32, i32>       // bytes written
closeSocket(fd: i32): void
```

Illustrative, not normative — the names, whether an fd is a bare `i32` or a
`Socket` class, and whether `recv` takes a maximum are §8's open questions. The
shape is not: a `Result` per call, no exceptions, no callbacks, no function
values.

Two things about that shape are worth stating, because they are the parts that
are already paid for. `Result<i32, i32>` is exactly the case WP17's private ABI
packs into **a single `i64`** — "passed and returned as one `i64` when both
payloads are scalars of at most 4 bytes" (LANGUAGE.md) — so a syscall wrapper
that returns a value or an `errno` costs one register and no allocation. And
these would be the **first builtins in the language to return a `Result`**: the
existing I/O surface either exits (`readFileSync`), answers `T | null`
(`readFileSyncOrNull`), or encodes failure in the value (`spawnSync`'s `-1`).
That is a deliberate widening rather than an accident, and the alternative —
`-1` and a separate `errno()` call — is the C shape this language has
`Result` in order not to have.

**Depends on.** WP20 T0 (thread-local arena — a worker thread that allocates is
a data race in the emitted IR without it) and T1 (spawn and join), plus §3.1's
budget restatement. T0 is already the thing WP24 recommended building anyway.

**Acceptance.**
- A TCP echo server and a minimal HTTP server in `examples/`, each under 100
  lines, built and run by the test suite against a Node client.
- `examples/hello.ts` links to the same byte count it does today — the
  pay-for-what-you-use proof, run in CI rather than asserted.
- The peak RSS of the HTTP server serving 10,000 sequential requests is flat,
  proving the per-request arena reset (§3.4) does what it claims.
- Every new builtin has a golden `.ll`, an `llvm-as` pass, a native round trip
  and at least one negative test, per the standing checklist.
- The differential decision of §3.3 is written into `known-failures.txt` or
  `wp13-differential.md` before the first builtin lands, not after.

**The number to write down**, because it is S2's baseline: connections per
second and peak RSS at 100, 1,000 and 10,000 concurrent connections, on the
fixed pool of §3.2. Published in BENCHMARKS.md beside the seven existing
programs.

### S2 — The reactor

**Surface.** Still builtins, still no syntax:

```ts
setNonBlocking(fd: i32): Result<void, i32>
pollerNew(): Result<i32, i32>
pollerAdd(poller: i32, fd: i32, events: i32): Result<void, i32>
pollerWait(poller: i32, timeoutMs: i32): Result<i32, i32>   // ready count
pollerEvent(poller: i32, i: i32): i64                        // fd and events, packed
monotonicMs(): i64
```

`epoll` on Linux, `kqueue` on the BSDs and macOS, `poll_oneoff` on WASI. The
packed event is WP17's two-scalar trick rather than a struct out-parameter,
which the ABI already does for `Result`.

`monotonicMs` is the first clock in the language. WP24 §10 left "whether a
`sleep(ms)` builtin should exist at all" open and leaned towards no; a reactor
answers it — a timeout is not `sleep`, it is the poller's own argument, and a
monotonic clock to compare deadlines against is the smallest thing that makes
timeouts expressible.

**Acceptance.**
- The same HTTP server, rewritten as one thread over a poller with a
  hand-written `while` / `switch` state machine, in `examples/`. It will be
  ugly. It running is the point, and its ugliness is S3's entire argument.
- Connections per second and peak RSS at the same three concurrency levels as
  S1, in the same table. **If the reactor does not beat the thread pool at
  10,000 connections, S3 has no case and this note says so** — that is the
  measurement WP15 item 3 was closed by, applied here.
- `examples/hello.ts` still links to the same byte count.
- A program that uses the poller and one that does not are byte-identical
  except for the poller.

### S3 — `async` / `await`

Everything in [wp24-async.md](wp24-async.md) §6 A3: the colour rule, the
suspend point, the anonymous frame type built rustc-shaped (§3b there — a
struct with a state discriminant and a `switch`, not `llvm.coro.*`), the
fourth escape flow, and the arena rule §9.2 of that note already wrote down —
*a function that can suspend gets no automatic scope, and an awaited call gets
no call-site reclaim bracket*.

**Acceptance is a comparison, not a feature list.** The S2 server, rewritten
with `async`/`await`, must (a) be materially shorter and readable as
straight-line code, (b) land within noise of S2's connections-per-second and
peak RSS, and (c) leave `examples/hello.ts` at its byte count — a program that
never awaits links no scheduler. If (b) fails, the reactor is the language's
answer and the syntax is not worth the fixpoint.

### S4 — Futures as data

WP24 A4, after WP18. An array of pending calls, `join`, `select`, a work
queue. An enhancement of S3 rather than a gate in front of it (WP24 §4.1), and
the first stage that needs monomorphisation.

## 5. What this forces on other packages

| Package | What changes |
| --- | --- |
| MASTER_PLAN §2 | the runtime budget rule is restated as a per-program linked size, with a CI check; the three stale figures are corrected (§3.1) |
| [wp20-threads.md](wp20-threads.md) | T1's structured join cannot express an accept loop (§3.2). T1 stands, S1 works within it, and a `Thread[]` stage between T1 and T3 is the smallest fix. T0 gains a second customer and a reason to be first |
| [wp15-performance.md](wp15-performance.md) | item 5, the fast slice, is what an HTTP parser is made of (§3.4); a server is the program that justifies it |
| [wp13-differential.md](wp13-differential.md) | owes a written decision on socket builtins before the first one lands (§3.3) |
| [wp21-packages.md](wp21-packages.md) | an HTTP server is the first Nish program with a real dependency, and the flat symbol namespace is its blocker. Package-scoped symbols were already "worth landing early"; this is the program that says why |
| [wp19-stage0-retirement.md](wp19-stage0-retirement.md) | every stage here lands **twice** until stage0 is deleted (WP24 §4.8). That multiplier is the strongest argument for taking M4 and M6 first, and it grows with each stage |
| [wp24-async.md](wp24-async.md) | §1 flips from a refusal to a plan gated on this note; §6's A2 is owned; §8's trigger has fired |

## 6. The one thing to build first, and it is not in the stages

**WP20 T0, the thread-local arena.** It is S1's prerequisite, it is WP24 A1's
whole cost, it is the prerequisite for every WP20 stage and for the detached
designs §3.4 of that note defers, and it has no language surface. Beside it,
§3.1's budget restatement, which is a paragraph and a CI check.

After those two, the ordering question is not technical but strategic, and it
is the project's to answer rather than this note's: **S1 costs double until
stage0 is deleted.** WP24 §4.8's multiplier applies to every builtin, every
diagnostic and every golden here, and it is applied to whatever the language
is on the day the work starts. M4 and M6 are cheaper the sooner they happen,
and they get more expensive with every stage of this note that lands before
them.

## 7. Declined, with the rule each one breaks

- **A green-thread or M:N scheduler.** Unchanged from wp20 §1 and wp24 §7: a
  growable stack needs relocation, relocation needs a precise GC, and zero GC
  is MASTER_PLAN §1's first bullet. A server does not change that argument; it
  is the workload that most tempts it, which is why it is first here.
- **Callback I/O** (`onConnection(cb)`, `socket.on("data", cb)`). Needs a
  function value, which Phase 0 forbids for the attribute-fixpoint reason
  (wp24 §4.2). This is the same refusal WP20 §2 counts as an asset, and it is
  the reason the S2 loop is a `switch` rather than a dispatch table.
- **TLS in the runtime.** A TLS implementation is larger than this compiler
  and is not a runtime's job at any budget. The honest answers are a terminating
  proxy in front, or an FFI binding to the platform's TLS once WP8's C interop
  grows an import direction — which it does not have and which is its own note.
- **An HTTP parser in the runtime.** It belongs in Nish, where it is a byte
  loop over `charCodeAt` (§2), and the runtime budget is the reason but not
  the only one: a parser in C would be the first piece of user-facing semantics
  that neither compiler can see.
- **`io_uring`.** A second, Linux-only completion model beside the readiness
  model every other target has, for a throughput win nobody here has measured.
  Revisit when S2 has a number it is trying to beat.
- **Asynchronous file I/O.** wp24 §2's table already settles it: a regular
  file is always ready to a readiness poller, which is why Node's own `fs`
  async is a thread pool. If it is ever wanted, it is a thread pool over the
  synchronous calls that already exist, and that is WP20's, not this note's.
- **A `sleep(ms)` builtin, as such.** §S2 gives timeouts to the poller and a
  monotonic clock to compare deadlines against, which is what a timeout
  actually needs. A bare `sleep` that blocks a thread is the thing a reactor
  exists to avoid, and wp24 §10 already leaned against it.
- **Matching Node's microtask semantics** (if S3 lands). Unchanged from wp24
  §7: not declined on the merits, declined as a thing to sign up for before
  there is an implementation to hold to it.

## 8. Open

- **Whether an fd is a bare `i32` or a `Socket` class.** A class gets methods,
  a destructor-shaped `close` and type safety against passing a file fd to
  `send`; an `i32` needs no new layout and no new escape question. Decide
  against the S1 echo server, not here.
- **Shared `accept` versus `SO_REUSEPORT`** (§3.2). Measurable; measure it.
- **`Thread[]`, and whose stage it is.** WP20's, on the evidence of §3.2, but
  this note is the customer.
- **The differential decision of §3.3**, which is the one open item with a
  deadline: it has to be written down before the first socket builtin lands.
- **Whether WASI preview1 can serve at all.** It has `poll_oneoff` and, in
  later snapshots, `sock_accept` / `sock_recv` / `sock_send`, but no way to
  *create* a listener — a host must pass one in as a preopen. So a WASI build
  may be able to serve on a supplied socket and will not be able to dial out.
  This needs verifying against the wasi-sdk the project pins rather than
  taken from this paragraph, and the answer decides whether S1's surface is
  the same on all three targets or is honestly Linux-and-BSD-only with a
  documented WASI subset.
- **Whether S3 is ever reached.** It is gated on S2's number (§4). This note
  does not assume the answer, and the project's own precedent — WP15 item 3,
  closed by measurement rather than built — is that the honest outcome of a
  measurement is sometimes that the feature is not needed.
