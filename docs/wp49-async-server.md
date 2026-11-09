# WP49: `async`/`await` on the server, and the TechEmpower top

**Status: D1 accepted; stages 1 to 4 built, stage 5 in part (§10), stage 6
open.** The language half — `async`, `await`, `Promise<T>`, `spawn`,
`awaitAll` and the frame lowering — compiles, and runs on the executor that
waits on sockets and timers (stage 5, part 1), with async `fetch` (part 2)
and tasks that share their spawner's objects (part 3); `serve`, the async
Postgres pool and cancellation are not built. The anchors below
are at `a9fcb8d`. [LANGUAGE.md](LANGUAGE.md) stays normative; the API in this
note beyond what it states is a proposal and is not compiled by `npm test`. This note reopens
[wp24-async.md](wp24-async.md)'s refusal (§1 says why), and its decisions are
the owner's (§9). The owner accepted D1 on 2026-11-01, on one condition: an
`await` never blocks the process, and `async` costs the server nothing it
would not pay written by hand. §6's gate is how that condition is checked.

Two goals, one design:

1. **A server near the top of the TechEmpower Framework Benchmarks (TFB)**, on
   every test type, not just `plaintext` and `json`
   ([wp39-http-server.md](wp39-http-server.md) Part A).
2. **A server a TypeScript programmer can read on day one.** A route handler
   that calls another service writes `await fetch(url)` and goes on, and the
   process serves other requests until the answer arrives.

The same mechanism serves both. TFB's database tests are won by servers that
keep many requests in flight per core and pipeline their queries to Postgres.
That is the waiting `await` writes down.

## 1. Why reopen WP24

WP24 refused `async` because "there is nothing to await" (§2), and when
`nish:net` arrived it answered with a loop the program owns (§8). That answer
holds for speed: the explicit loop is as fast as a server gets. It does not
hold for the second goal. Once a handler waits on something, the program
has to keep each request's state by hand, as `nish/net/handler`'s "a request
may be answered later" describes, and dispatch every completion itself. One
outbound call per route is manageable. Three in a row (auth, then a
lookup, then a write) means a hand-written state machine per route.
`async`/`await` makes the compiler write that state machine.

WP24 §4 lists what that costs. §5 below answers each item. Most of them go
away under three restrictions, all in §2: a promise is never a value, async
functions never recurse, and every task has a region of its own.

## 2. The language

TypeScript's syntax, with these restrictions:

- **`async` functions and `await`.** An `async` function is a top-level
  function or an arrow passed to a function-typed parameter. Its return type
  is written `Promise<T>`, and `Promise<T>` may appear nowhere else.
- **`await` takes a direct call to an `async` function.** Calling an `async`
  function anywhere else is refused, with one exception: the argument of
  `spawn` (below). So no expression ever has a promise type. There is no
  `.then`, no promise stored in a variable or field, and no promise in an
  array. WP24 §7 declined a user-nameable `Promise<T>`, and this keeps that
  decision.
- **`spawn(f(args))` starts a task** that runs `f` alongside the caller and
  is not awaited. The server uses it once per request. A task's answer is
  dropped, so its `T` must be `void` or a `Result` the program logs.
- **`awaitAll(f(a), g(b))` waits for a fixed number of calls at once.** This
  is WP24 §9.3's fixed-arity join: two to eight calls, each answer bound to a
  name of its own (`const [user, orders] = awaitAll(...)`). An array of
  promises (WP24's A4) stays out.
- **No recursion through `async`.** A cycle in the call graph that runs
  through an `await` is refused. This is Rust's rule without `Box::pin`. It
  makes every task's frame a size the compiler knows (§3).
- **`async` spreads upward.** An `await` can only appear inside an `async`
  function, so a call reached from `main` makes `main` async:
  `export const main = async (): Promise<i32> => ...`. A program with no
  `async` function is unchanged, byte for byte (WP24 §4.5).

### Where it is not Node

The programmer sees TypeScript, but the resume order is not Node's. Stage 4
states these in LANGUAGE.md as declared differences, with the construct:

| Node | Nish |
| --- | --- |
| Every `await` yields to the microtask queue, even on a value that is already there | An `await` on a call that finishes without waiting returns at once. Nothing else runs in between |
| Microtasks run before I/O callbacks, in a defined order | Tasks resume in the order the kernel reports readiness, then by timer deadline |
| A rejected promise throws at the `await` | There is no `throw`. A failure is the call's `Result` or `null`, as every Nish call reports it |

A program whose output does not depend on how its tasks interleave prints
the same under Node and native. That covers every program with one task,
and every server whose responses depend only on their own request.
Differential cases are written that way. A program that races two tasks to
the same `console.log` is not an oracle test.

### What a handler looks like

```typescript
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, serve, ServeLimits } from "nish/net/serve"
import { fetch } from "nish/net/fetch"

const HOME: i32 = 0
const USER: i32 = 1

const user = async (req: Request): Promise<Response> => {
  const res = await fetch(`http://users.internal/v1/${req.param("id")}`)
  if (res.isErr()) { return Response.status(502) }
  const body = res.value.text()
  return Response.json(200, body)
}

const handle = async (req: Request): Promise<Response> => {
  switch (req.route) {
    case HOME: return Response.text(200, "Hello, World!")
    case USER: return await user(req)
    default: return Response.refuse(req) // 404, or 405 with its Allow
  }
}

export const main = async (): Promise<i32> => {
  const router = new Router(new RouterLimits())
  router.add("GET", "/")          // HOME
  router.add("GET", "/users/:id") // USER
  return await serve(8080, router, new ServeLimits(), handle)
}
```

`serve` takes `handle` as a function-typed parameter, so `serve` is
instantiated with `handle` as its callee
([LANGUAGE.md](LANGUAGE.md#function-parameters)). There is still no function
value and no indirect call. The route table is the `switch`, as in
`nish/net/router` today: a handler cannot be stored in the router, because a
function is never a value.

## 3. The lowering: a state machine per task, sized at compile time

This is rustc's arrangement, as WP24 §3b measured it and §9.3 named it. The
front end writes the state machine, and LLVM sees ordinary code:

- **Each `async` function becomes a frame struct and a resume function.** The
  frame holds the locals that are live across an `await`, plus a state
  number. Resuming is a `switch` on that number, and each `await` is a
  `return PENDING` after the frame is saved.
- **An awaited callee's frame is nested inside its caller's.** Frames at
  different `await`s share space, as a union does. Because async functions
  never recurse (§2), a task's whole tree of frames is one block whose size
  the compiler knows. `spawn(handle(req))` takes that block from a slab of
  that size, which grows to the peak number of requests in flight and is then
  reused. **No allocation per request once warm**, the discipline
  `tests/link/net_handler` pins today.
- **The executor calls no function pointer.** The compiler knows every
  `spawn` site, so the executor resumes a task through a generated `switch`
  on its kind (one case per spawned function). This keeps WP24's whole-program
  rule: no indirect call, and the fixpoint sees every callee.
- **Attributes.** WP24 §4.3 holds. A function with an `await` loses
  `willreturn`, and its saved locals lose `readonly`. A function without an
  `await` keeps everything it has today, even when an async function calls it.
- **Under `--profile debug`, frames are the same slabs.** WP24 §3a's worry
  was LLVM's `coro.elide` running only at `-O2`. Here the front end lays out
  the frames, so the cost model is the same in both profiles.

## 4. The runtime: one executor per process

**One thread per process, and one process per core.** The executor runs on
the thread that runs `main`. `nish/net/prefork` (WP42) gives the cores,
exactly as today. Tasks never move between threads or processes. A task that
waits holds no thread, so the process serves its other requests in the
meantime. Spreading load across processes is §6's job, not the executor's.
That is the thread-per-core shape the fastest TFB entries use. Since tasks
in a process take turns and never run at once, module state needs no lock
between two `await`s, as in Node.

**What a task can wait on.** Everything reduces to three primitives in a new
`nish:async` builtin module:

| Primitive | Waits for |
| --- | --- |
| `await readable(fd)` | the descriptor has bytes, or a hang-up |
| `await writable(fd)` | the descriptor can take bytes |
| `await sleep(ms)` | a deadline on the executor's timer heap |

Everything else is ordinary Nish in `std/`, written as `async` functions over
those three and the sans-IO codecs that already exist:

- `fetch` drives `nish/net/http1-client-codec`'s request writer and response
  parser;
- the Postgres pool drives `nish/net/postgres`;
- `serve` drives `nish/net/handler`'s machinery;
- DNS drives `nish/net/dns-resolver`.

Every one of those codecs was written sans-IO so that something could drive
it from a loop. The executor is that loop.

**The loop is `pollWait`.** An epoll (kqueue on Darwin) entry carries a task
index and a generation, so a completion for a task that has since finished
is dropped. That is the same generation rule `nish/net/handler` uses for a
late answer. The executor is a runtime unit of its own, `runtime-async.c`,
linked only into a program that has an `async` function, with its own
`tests/runtime-budgets.js` ceiling.

**Cancellation.** A task is cancelled when its client hangs up, its deadline
passes, or the server shuts down. Cancellation never drops a frame halfway.
Every `await` the task is parked on, and every later one, answers at once
with the call's own failure value. The task then runs to its end, its
`using` bindings are disposed, and its region is freed. Without `throw`,
nothing unwinds, so this is the only safe kind.

**A panic still ends the process.** Nothing unwinds, so one task's panic
takes down that worker, and `nish/net/prefork` starts another. This is
WP42 §1's crash-isolation argument, unchanged.

**wasm.** `--profile wasm` refuses `async` until a host loop is designed
(WP24 §4.6). Under Node ([RUN_UNDER_NODE.md](RUN_UNDER_NODE.md)), the
emitted TypeScript runs on Node's own loop.

## 5. Memory: a region per task

WP24 §9.2 is the hard item. The arena brackets automatic scopes with
`nish_arena_mark` and `release` and assumes nothing else allocates in
between. A suspended task breaks that assumption: while it waits, other
tasks allocate in the same arena.

**The answer is to give each task its own region**
([wp46-long-running-memory.md](wp46-long-running-memory.md), §2.1). While a
task runs, its allocations go to its region. When it finishes, the region is
freed. Inside one task, mark and release are contiguous again, because only
that task allocates in its region. So the brackets and the call-site reclaim
keep working unchanged within a task. This also gives a long-running server
WP46's bound for free: memory follows the requests in flight, not the
requests served. Freed region chunks go back to a free list, so a warm
server makes no `malloc` per request.

A value a task stores where it outlives the task, such as module state or a
cache, must not point into the task's region. The region rules of
`nish:region` (NL2609 through NL2618, `src/region-rules.ts`) refuse that for
`region(...)` blocks, and a task is a region block whose extent ends at the
task's end: the same walk judges a spawned function's body against the
objects it was handed ([Stage 5, part 3](#stage-5-part-3-a-task-reaches-what-its-spawner-owns)).
A program that wants a value to outlive the task copies it out.

**So this work package waits for WP46 stages 1 and 2.**

## 6. TFB: what the top takes

What we have today, on one core of a shared 4-vCPU VM
([BENCHMARKS.md](BENCHMARKS.md#techempower-json-and-plaintext), 2026-10-21,
wrk on the same machine):

- **`plaintext`, 16 deep:** 324k req/s at 256 connections. uWS reaches 412k
  and fasthttp 380k on the same machine. The noise band is 1.0%.
- **`json`:** 89k req/s at 256 connections.
- **The other test types** (`db`, `query`, `update`, `fortune`,
  `cached-query`) are not built. `nish/net/postgres` has the protocol,
  pipelining included, and connects over TCP and Unix sockets, but it has no
  pool and no carrier yet (WP39 E6).

TFB ranks each test type, and five of the seven read the database. In order
of what they move:

1. **Postgres pipelined across requests.** The strongest `db`, `query` and
   `update` entries keep a few connections per core and send queries from
   many requests in flight down each connection before one Sync. They
   prepare statements once and read results in binary. In this design that
   is the Postgres pool of §4: a task's `await pool.query(...)` joins the
   connection's next batch. This needs tasks, so it needs §2–§5, or the
   explicit-loop fallback in §7.
2. **Every core, evenly.** Pin each prefork worker to its own core
   (`sched_setaffinity`, which prefork does not do today). Steer each
   connection to the worker on the core whose queue received it
   (`SO_INCOMING_CPU`, or a `SO_ATTACH_REUSEPORT_CBPF` program), so a packet
   and its handler stay on one core's cache.
3. **The `plaintext` gap to uWS** (about 21% at 256 connections) is in user
   space. System calls are already about 2 per request, and io_uring was
   measured not to pay ([bench/README.md](../bench/README.md), "Syscall
   cost"). Profile it per request: the parser, the route lookup, the
   response head.
4. **`fortune`:** an HTML escape, a byte sort and one buffer reused per
   response (WP39 E8).
5. **A rig like TFB's.** Our numbers come from wrk sharing the machine with
   the server. Before any claim about rank, measure with the client on its
   own machine, at TFB's connection counts, against the same twins.

**The gate on `async` itself:** the TFB entry is written in the `async`
style of §2. It must stay inside the noise band of the same entry written
in the explicit style, on `plaintext`, `json` and `db`. If it does not, the
lowering is fixed before the feature ships. The explicit style stays
supported regardless.

## 7. A non-blocking call from a handler today, without `async`

Until §2 lands, a handler makes an outbound call in the explicit style,
which is exactly what the compiler will later generate. The pieces are
`nish/net/handler` (a request may be answered in a later turn), the
`http1-client` codec, and one new module, `nish/net/upstream`. That module
is a pool of non-blocking connections to one origin, registered on the
handler's own poll loop:

```typescript
const h = new HttpHandler(new HandlerLimits(), listener, router)
const users = new Upstream(h, "http://users.internal", new UpstreamLimits())

while (true) {
  h.wait(1000) // one turn: the handler's sockets and the upstream's
  while (h.ready()) {
    const req = h.take()
    switch (req.route) {
      case USER: if (users.get(req, "/v1/users/7") !== UPSTREAM_E_NONE) { h.problem(req, 503, "Busy", "") } break // returns at once
      default: h.refuse(req)
    }
  }
  while (users.ready()) { // answers that arrived this turn
    const r = users.take() // r.req is the request that asked
    if (r.ok) { h.send(r.req, 200, JSON, r.body, 0, r.length) }
    else { h.problem(r.req, 502, "Bad Gateway", "") }
    users.release(r)
  }
}
```

`users.get` writes the request on a free keep-alive connection, or queues it
if none is free, and returns. The request stays held, as the handler already
allows. When the upstream's socket turns readable, the next `h.wait` reads
it through the codec. A finished response then shows up in `users.ready()`,
tagged with the request that asked for it. Nothing blocks, and the process
serves every other connection in the meantime. The Postgres pool takes the
same shape, and it is what the TFB database tests can use before §2 exists.

`Upstream` applies `nish/net/outbound`'s policy when its origin comes from
input, and it lands with its record under `docs/security/` (CLAUDE.md,
"Attacker-facing code ships with its security record").

As built (`std/net/upstream.ts`, record `docs/security/upstream.md`, guide
`docs/guide/using-nish/calling-services.md`): the handler has no `loop()`
method, so `Upstream` takes the handler itself and uses its public `loop`,
`turnAt` and `fired`. Each connection takes one of the handler's 16 watch
ids (`UpstreamLimits.firstId` and up), and `ready` reads the sockets that
fired, once per turn. `get` answers `UPSTREAM_E_FULL` when every call slot is
taken. Deadlines are checked when `ready` runs. Each connection keeps one
`http1-client` parser, reset between connections and switched to spans mode
(`fieldsAsSpans`), which records a response's fields as spans of a head buffer
it reuses, so `Arena.used()` stays flat over thousands of warm calls
(UPSTREAM-8, fixed).

## 8. Names

| Today | Proposed | For |
| --- | --- | --- |
| `nish/net/http-client`: `httpFetch`, `HttpClient` | `nish/net/fetch`: `fetchSync`, `FetchSyncClient` | a program that wants to block, without `async`; `Sync` as in Node's `readFileSync` |
| — | `nish/net/fetch`: `fetch` | `async` programs, CLI and server alike; non-blocking under the executor |
| — | `nish/net/upstream`: `Upstream` | the explicit-loop server (§7) |
| `nish/net/http1`, `nish/net/http1-client` | `nish/net/http1-codec`, `nish/net/http1-client-codec` | anyone building a carrier; sans-IO |

With `async` there is one `fetch`, and in a command-line program it behaves
like the blocking one: `main` is the only task, so `await fetch(url)` simply
waits. `awaitAll(fetch(a), fetch(b))` runs both at once there too. The
separate "sequential `await`" idea for command-line programs only is
superseded by this note.

**The body is read eagerly.** `fetch` reads the whole body before it
answers, up to `maxBodyBytes` (256 MiB by default; past it the fetch fails
with `HTTP_E_BODY_TOO_LARGE`), so `text()` and `bytes()` on the
`FetchResponse` are plain methods, not awaited. A streamed body would need a
reader the caller awaits chunk by chunk, holding the connection between
awaits; that is a later API beside this one, not a change to it. `fetch`
answers a `Result<FetchResponse, FetchError>` rather than null, so the
`HTTP_E_*` code and its sentence come with the failure: there is no client
object to read them from afterwards.

**The pool is the fetch's own.** The async `fetch` keeps idle connections in
a new `FetchPool`, which a caller opts into through `RequestInit.pool`;
without one each fetch has a connection of its own. It is not §7's
`Upstream` pool: that one belongs to an explicit loop and holds connections
it drives itself, while a `FetchPool`'s connections are driven by whichever
task takes one. The two share the parser, the request writer and the policy
helpers, not their pools.

The renames are a breaking change (`refactor!`). The project stays on 0.x,
so this moves the minor version. 35 files under `std/`, `src/`, `examples/`,
`docs/` and `tests/` name the two old module paths.

## 9. Decisions for the owner

| | Question | Recommendation |
| --- | --- | --- |
| **D1** | Reverse WP24's refusal for the restricted `async` of §2 | **Accepted** (2026-11-01), on the condition that an `await` never blocks and `async` costs nothing the explicit style does not. No promise value, no recursion, a region per task; the TFB gate of §6 decides whether it ships |
| **D2** | Tasks in a process take turns on one thread, and never move between processes or threads | **Yes.** The fastest servers are thread-per-core, it needs no lock between `await`s, and a task's frame and region never cross an arena (WP47 §6) |
| **D3** | Cancellation answers every later `await` with the call's own failure, and never drops a frame halfway | **Yes.** Without `throw`, it is the only kind that keeps `using` and the region correct |
| **D4** | The renames of §8 | **Yes**, in one PR of their own, before `fetch` becomes async |
| **D5** | Build §7's explicit `Upstream` and the Postgres pool before §2 | **Yes.** They are the TFB database tests' critical path, and §4's `async` versions are thin wrappers over them |
| **D6** | Submit to TFB, and when | WP39 D1 stands: after every test type passes the verifier and has numbers from a separate client machine. A public number is the owner's call each time |
| **D7** | How `fetch` takes its options without `undefined` | A nullable parameter may default to `null`, so `fetch(url)` and `fetch(url, init)` are one function; optional parameters stay refused. **Accepted**; the checker allows `init: RequestInit \| null = null` ([LANGUAGE.md](LANGUAGE.md#default-and-rest-parameters)) |

## 10. Stages

Each stage is one pull request, with the work each one needs:
[ARCHITECTURE.md](ARCHITECTURE.md) "How to add a construct" for stage 4, a
`docs/security/` record for anything that reads the network, and a guide
page for anything a user sees.

| Stage | What | Waits for | Built |
| --- | --- | --- | --- |
| 1 | The renames of §8, old paths removed | — | yes |
| 2 | `nish/net/upstream` (§7) and the Postgres pool and carrier (WP39 E6), explicit style, each on the handler's loop | — | yes |
| 3 | TFB `db`, `query`, `update`, `cached-query` and `fortune` on stage 2 (WP39 E7, E8); prefork pinning and connection steering (§6 item 2) | 2 | yes |
| 4 | The language: `async`, `await`, `Promise<T>` as a return type, `spawn`, `awaitAll`, the no-recursion rule, the frame lowering of §3, the emitted TypeScript, and the declared differences | WP46 stages 1–2 | yes |
| 5 | The executor (`runtime-async.c`, `nish:async`), `serve`, async `fetch`, the async Postgres pool, cancellation | 4 | in part: the executor (part 1, #1283), async `fetch` (part 2, #1293) and a task reaching its spawner's objects (part 3); `serve`, the async Postgres pool and cancellation are open |
| 6 | The TFB entry rewritten in the `async` style, held to §6's gate against stage 3's | 3, 5 | no |

`src/` may use none of this until a release ships it (CLAUDE.md, the rolling
freeze), and the compiler has no reason to.

## Stage 4, part 1: the checker's codes and decisions

Part 1 checked the language of §2 and refused a program that kept an `async`
function (NL2653, retired by part 2), so a program with no `async` compiled
byte for byte as before. The lowering of §3 is part 2, below; the emitted
TypeScript follows it.

| Code | Refuses | Test |
| --- | --- | --- |
| NL1063 | `async` on a method, field or constructor | `reject_async_method` |
| NL2654 | `Promise<T>` anywhere but an `async` function's return type | `reject_async_promise_parameter`, `_field`, `_local`, `_alias`, `_interface_member` |
| NL2655 | an `async` function whose return type is not `Promise<T>` | `reject_async_function`, `reject_async_arrow_declaration`, `reject_async_return_missing` |
| NL2639 | an `async` arrow where the function type answers a plain `T` | `reject_async_arrow` |
| NL2640 | a plain function where the function type answers `Promise<T>` | `reject_async_plain_to_promise_parameter` |
| NL2641 | `await` outside an `async` function, a module constant included | `reject_await`, `reject_await_constant` |
| NL2642 | `await` inside a larger expression | `reject_async_await_nested`, `_condition`, `_compound`, `reject_async_await_all_for` |
| NL2643 | `await` on anything but a call | `reject_async_await_value` |
| NL2644 | `await` or `spawn` on a plain function's call | `reject_async_await_plain_call` |
| NL2645 | an `async` call that is not awaited, spawned or joined | `reject_async_unawaited_call`, `_argument` |
| NL2646 | `spawn` of a task answering neither `void` nor a `Result` | `reject_async_spawn_answer` |
| NL2647 | `awaitAll` of one call, or not awaited into one name per call | `reject_async_await_all_one`, `_bare` |
| NL2648 | recursion through `await`, direct or mutual | `reject_async_await_self`, `_mutual` |
| NL2649 | `Promise.all` and the other `Promise` statics | `reject_async_promise_all` |
| NL2650 | `.then`, `.catch`, `.finally` | `reject_async_then` |
| NL2651 | `await(f(x))` outside an `async` function, a call to a function named `await` | `reject_async_await_parenthesised` |
| NL2652 | `async` in a wasm build, `--target wasm32` or `--profile wasi` | `reject_async_wasm`, `reject_async_wasi_profile` |
| NL2653 | retired by part 2: an `async` function in a program that passes every rule, not yet lowered | `async_lowered` (the case, renamed, now compiles) |

NL2133 (`for await`) keeps its code with a new message. NL1015 (`async`
refused outright), NL2173 and NL2174 (`Promise` and `.then` unknown) are
retired, and NL1004 loses its "no event loop" tail.

Decisions taken in part 1:

- **`await` stands at the top of a statement** (an expression statement, a
  declaration's initializer, a `return`, the right side of a plain `=`). An
  `await` inside another expression would hold the values already computed
  across the wait, which the frame of §3 would have to carry; binding to a
  `const` first costs one line and keeps every frame slot a named local.
- **`awaitAll` is itself awaited**, `const [a, b] = await awaitAll(...)`, so
  every wait in a function is spelled `await` and the frame's resume points
  are exactly its `await`s.
- **`await (f(x))` follows TypeScript**: inside an `async` function it is the
  operator, `await f(x)`; outside one TypeScript parses it as a call to a
  function named `await`, which is refused (NL2651) when none is declared.
- **A method is never `async`** (NL1063, a parse-time code beside the other
  declaration-form refusals), since a task keeps no `this`.
- **The cycle check runs over the whole program** once every module is
  checked, and reports at the `await` that closes the cycle, in the module
  that wrote it.

## Stage 4, part 2: the lowering

Part 2 compiles what part 1 checks, as §3 lays it out (`src/emit-async.ts`).
NL2653 is retired; NL2652 (wasm) stays. A program with no `async` function
writes the same IR as before, byte for byte, over every positive case.

- **A frame and a resume function per function that awaits.** `f` becomes
  `i1 @f.resume(i8* frame)`, answering true when it finished. The frame is
  `{ i32 state, parameters, answer, rest }`; `rest` holds the callees' frames
  (`kids`, sized for the largest single `await` or `awaitAll`), every
  `alloca` of the body and every value live across an `await`. The function
  is first emitted as an ordinary one and then rewritten, so every other
  lowering is untouched.
- **A function that awaits nothing is a plain function**, and awaiting it is
  a plain call; it keeps every attribute it had. One that awaits loses
  `willreturn` and `readonly` (§3, "Attributes"; `async_attributes`).
- **Frame sizes are a whole-program fact.** A callee's frame may live in
  another module, so `kids` and the `spawn` node's size are written as marks
  and replaced once every module is emitted.
- **The driver is in-process.** `spawn(f(x))` puts `f`'s frame in a
  `malloc`ed node, resumes it once and queues it if it pends;
  `@nish.async.step` and `@nish.async.drain` resume queued tasks through a
  `switch` on the task's kind, one case per spawned function, never a function
  pointer. An `async` `main` is resumed from the C entry until it finishes,
  then the queue is drained. In this stage nothing pends on the outside world,
  so a task runs until it finishes when it is first resumed, and a queue
  that still holds tasks but makes no progress traps.
- **The declared resume-order difference this adds**: `spawn` runs its task
  at once, up to its first real wait, where Node runs it only to its first
  `await` and the rest after the spawning task yields (`async_spawn`,
  `docs/LANGUAGE.md`, "Where it is not Node").
- **`--emit-ts` writes an `async` function as Node async/await** (part 3;
  NL4016, its refusal until then, is retired): `docs/LANGUAGE.md`, "Under
  `--emit-ts`", and `tests/emit-ts/async/`.

Stage 5 replaces the driver, and nothing in the frame layout: the `malloc` per
spawn with a slab per spawned kind, the queue with the executor of §4 in
`runtime-async.c` (an `epoll`/`kqueue` loop, timers, wake-ups), the trap on a
stuck queue with a wait on the kernel, and adds what pends for real —
`nish:async`'s loop, `serve`, async `fetch` and the async Postgres pool.

Three things are sound in this stage only because nothing pends, and stage 5
owes each of them before a task may wait on the kernel:

- **The arena is a stack.** A suspending function marks and releases the
  arena as a plain one does, so two tasks interleaving at a real wait would
  release each other's allocations. Each task needs its own arena, or the
  frame must hold what it allocated across an `await`.
- **A spawned task's arguments must outlive the spawner.** `spawn` copies the
  argument values into the node, not what they point to; a string or array
  built in the spawner's arena dies when the spawner returns while the task
  still waits.
- **A synchronous `main` drains its tasks only at exit.** Today every task
  has finished before `spawn` returns; once one can pend, the C entry must
  run the loop after a plain `main` too, not just after an `async` one.

## Stage 5, part 1: the executor and the first waits

Part 1 replaces stage 4's in-process queue with the executor of §4 in
`runtime/runtime-async.c` and adds the three waits every later stage builds
on: `sleep(ms)`, `readable(fd)` and `writable(fd)` in `nish:async`. Async
`fetch`, `serve`, the Postgres pool and cancellation are later parts. The
security record is [`security/async.md`](security/async.md).

- **The executor.** A task is a node from a slab per spawned kind (a free
  list refilled by doubling chunks, never given back to `malloc`), with a
  permanent index and a generation that moves on each reuse. A wait is a
  token, `(generation << 32) | (slot + 1)`, polled by the resume that follows
  the `await` (`nish_async_poll`: `-1` pending, else the answer); a wait that
  can be answered at once is made already fired, so the task never suspends
  for it. `nish_async_next` answers the head of the ready queue, or blocks on
  `epoll` (`kqueue` on Darwin) and a binary heap of timers, ties broken by the
  order they were made; it answers null when nothing waits. A completion whose
  generation no longer matches its task is dropped and counted
  (`nish_async_stat(1)`, ASYNC-1).
- **The driver.** `@nish.async.run` resumes the nodes `nish_async_next`
  answers through the same `switch` on the kind as stage 4, entering the
  node's region around each resume, and returns to the C entry when the next
  node is `main`'s (index 0, kind -1). `@nish.async.drain` runs it until
  nothing waits. The queue, `@nish.async.step` and the `free` per task are
  gone.
- **A descriptor wait owns a duplicate** (`F_DUPFD_CLOEXEC`), registered
  one-shot and closed when it fires, so two tasks can wait on one descriptor
  and a closed, reused number cannot answer for the new file (ASYNC-4).

The three debts stage 4 left are paid:

- **(a) The arena is a stack: a region per task.** Each spawned task owns a
  region (`runtime/runtime-region.c`), entered around every resume and freed
  when the task finishes (`tests/link/async_region_per_task`). `main` keeps
  the arena.
  An `awaitAll` call gets one too (the `awaitall-regions` stage, HF-13): it
  ran in its caller's arena before, so the first call to finish and release
  freed what a sibling still held. Its region is made before its first
  resume, entered around every resume, and handed to the caller's arena when
  the call finishes (`nish_region_adopt`, which frees the empty chunk a
  release at return leaves), so its answer stays readable and its
  temporaries are freed (`tests/link/async_await_all_lanes`,
  `async_await_all_lanes_large`, `tests/link/async_await_all_retain`). A
  call that finishes at once still pays for the region, about 179
  instructions (ASYNC-16, open).
- **(b) Spawn arguments outlive the spawner.** A `string` argument is copied
  into the task's region before the task first runs (`nish_async_copy_str`);
  numbers, booleans and enums are copied by value; any other type is refused,
  NL2673 (`tests/link/async_spawn_args`, `async_sleep_spawn_string`,
  `reject_async_spawn_array_arg`).
- **(c) A synchronous `main` runs the loop.** An `async` `main` that awaits
  nothing compiles to a plain call, and the C entry then drains the executor
  before it exits with `main`'s answer (`tests/link/async_sync_main_loop`).

**How the executor is linked.** `scripts/build.sh` greps the program's IR for
`^declare [^"]*@nish_async_`: the driver declares `nish_async_next` and every
spawn, wait and async `main` declares its runtime call, so a program with
`async` gets `runtime-async.c` compiled and linked beside `runtime.c`, and any
other program links none of it. `--runtime-objects` builds it into the runtime
cache with the rest (`src/run-cache.ts`), and `--runtime-from` links its
object only when wanted. Measured on this change: a non-async program's IR is
byte-identical to its IR before the executor landed (D1 over every positive
case: 918 the same, the 10 that differ all `async` by design), and `llvm-nm`
finds 0 `nish_async` symbols in `entry_main`'s binary against 49 in
`async_sleep`'s. `tests/runtime-budgets.js` holds the executor's `-Oz` `.text`
to `RUNTIME_ASYNC_TEXT_BUDGET`.

**What it does not do.** A wait has no deadline: a descriptor that never
becomes ready parks its task, and the program, until the peer sends or
closes (ASYNC-6, open until cancellation). The executor is cooperative and
runs on `main`'s thread (ASYNC-5). `--emit-ts` writes `sleep` as a
`setTimeout` and refuses `readable`/`writable` (NL4017). `async` stays
refused under the wasm profiles (NL2652).

## Stage 5, part 2: async `fetch`

`await fetch(url, init)` in `nish/net/fetch` drives
`nish/net/http1-client-codec`'s parser over a non-blocking socket and parks
its task on `writable` while a connect or a write is in flight and on
`readable` while it waits for the response, so `awaitAll(fetch(a), fetch(b))`
has both requests at the server at once (`tests/link/net_fetch_async_overlap`,
whose server answers neither until both have arrived) and a slow fetch does
not hold up another task (`tests/link/net_fetch_async`).

- **The shape.** `fetch(url: string, init: RequestInit | null = null):
  Promise<Result<FetchResponse, FetchError>>`. `RequestInit` holds the method,
  fields, body, the `HttpOptions` `fetchSync` takes and an optional
  `FetchPool`. The body is read eagerly (§8).
- **One policy for both clients.** The URL check, the route and proxy choice
  (the environment's `http_proxy`, `no_proxy` and the httpoxy rule), the request
  head, the redirect rule, the resolver with the outbound policy, and the error
  texts are helpers `FetchSyncClient` and `fetch` both call, so `HTTP_E_*`
  codes mean the same thing from either (`tests/link/net_fetch_async_policy`).
- **The pool.** A `FetchPool` keeps idle connections per route (origin, or
  proxy), at most `maxIdlePerOrigin` each and 64 in all, and checks one is
  quiet before it is taken. A fetch under an outbound policy neither keeps
  nor takes one.
- **Memory.** A fetch's allocations are its awaiting function's scope's and
  go with it: 2,000 fetches, each awaited in a function of its own, leave
  `Arena.used()` where it was (`tests/link/net_fetch_async_flat`). Awaited
  straight in one function's loop, the responses stay until that function
  returns.

**What it does not do.** The name lookup blocks the process, within
`connectTimeoutMs`. A wait has no deadline (ASYNC-6), so `readTimeoutMs`
bounds nothing and `totalTimeoutMs` is checked when a wait ends. https is
refused with `HTTP_E_TLS`, naming `fetchSync`, before anything is dialled:
the TLS handshake would block, and a silent block is worse than a stated
refusal. `--emit-ts` refuses a program that uses it, as it refuses
`readable` and `writable` (NL4017). The record is
[`security/fetch.md`](security/fetch.md#the-async-fetch) (HF-10, HF-11).

## Stage 5, part 3: a task reaches what its spawner owns

Until this part `spawn(f(x))` took only numbers, `boolean`s, enums and
`string`s (NL2673): a handler could not be handed in, and no task could see
state its spawner set up. A server wants both: `spawn(task(handle, state, i))`,
where `handle` is the function each connection runs and `state` is a counter
or a table every task reads.

**The rule as built.**

- **A function argument.** A compile-time function parameter (WP29) of the
  spawned function is a position, not a value: the call is an instantiation
  of its own, one task kind each, and nothing crosses at run time. It is
  capture-free by WP29's rule, so it is accepted. The refusal names any other
  argument's type as written, never the `void` a compile-time position holds
  in `paramTypes`.
- **A shared argument.** An object, array, `Map` or `Set` argument is
  accepted when the spawner's memory outlives every task holding it. A
  spawn retains its argument: the escape analysis reads the argument of a
  spawned call as retained (`classifyUse`), so an allocation that reaches it
  *leaks* (`allocLeaks`), and the spawner, every function on the call chain
  above it and every loop pass around it lose their automatic scope, as a
  store into module state already makes them. `main`'s own allocations are
  released only after `@nish.async.drain`, when no task is left. A `using a =
  arena()` block that releases under a spawn is refused (NL2421, the
  using-arena rule, for the spawn itself and for a callee that spawns).
  A shared argument that holds, in any field or element, a `Region`, a
  `Secret`, a handle class a `using` block closes, or a `nish/threads`
  scope, lock, guard or channel is refused at the spawn (NL2691,
  `taskShareObstacle`): its spawner frees, wipes or closes that part on its
  own schedule.
- **Only from outside a task.** A function a task may run — a spawned
  function and everything it calls or awaits — allocates in the task's
  region, which is freed when the task ends; a nested task could outlive it.
  So a shared argument there is refused (NL2689), and nested spawns keep
  taking numbers and strings. A function argument that captures a local is
  refused as well (NL2690).
- **What a task may do with it.** The spawned function is walked by the
  region rules with each shared parameter as *outer* memory. Storing memory
  the task allocated into it (a string, an array, an object) is NL2609, and
  growing it (`push`, `Map.set`, `Set.add`, `spawnPiped` appending to its
  output arrays) is NL2615, directly or through a callee, a method or an
  arrow, by the same facts a `region(...)` body is judged by. A callee
  handed both a shared object it writes into and a string or object of the
  task's is refused outright: a string has no pointer facts to say it is
  not kept. Reading it, and writing numbers, `boolean`s and enums into it,
  is allowed: they are copied.
- **The task keeps none of it.** Putting the shared object, or anything
  reachable from it, into the task's own memory is NL2610, as in a
  `region(...)` body: a constructor argument, an array or object literal, a
  field or element store, `push`, a container's `set` or `add`, a method
  that may keep its argument in its receiver, and a callee that stores one
  argument into another. Kept there, the task could store its own memory
  into the shared object through the holder, past the direct-store rule.
  An object a helper makes may hold what the helper was handed, so in a
  task a fresh helper's answer (other than a string) joins its arguments'
  origins: a holder a helper, an async helper or `awaitAll` builds from the
  shared object is not the task's alone, and a store through it is NL2609.
  The task reads and updates the shared object in place, which is all
  `serve` and the pool need.
- **Interleaving.** The executor runs one task at a time on one thread, and
  a task gives way only at an `await`, so a read-modify-write of a field with
  no `await` inside it is atomic with respect to every other task.

**Soundness cases** (each has a test):

| Shape | Answer |
| --- | --- |
| task stores through a method or a callee | walked through the callee's facts: NL2609 / NL2615 |
| task hands a callee or method both a shared object it writes into and a string or object of its own | refused (NL2609): a string has no pointer facts, so the callee's facts cannot say the one is not stored into the other |
| a local bound by `for...of`, a helper's answer, a callback's parameter, narrowing or `const [a, b] = await awaitAll(...)` | carries its value's origin; a local the walk does not bind is unknown, so storing it is NL2609 |
| the shared object put into the task's own memory: constructor, array or object literal, field or element store, `push`, `Map.set`, `Set.add`, a method that keeps it, a callee that stores it into another argument | refused (NL2610) |
| a holder of the shared object answered by a helper, an async helper or `awaitAll` | the answer joins its arguments' origins; a store through it is NL2609 |
| a `using arena()` block inside the task | its memory is the task's; storing it into the shared object is NL2609 |
| an object reachable through a field of the shared object | outer, as the field read answers outer memory |
| an array of objects | outer elements; storing a task object into one is NL2609 |
| the shared parameter aliased into a local, then stored through | the local is outer by the walk's fixpoint |
| nested spawn from a task | a shared argument is refused (NL2689) |
| the spawner reassigns its local after the spawn | the task holds the object, not the local; the object stays |
| `using` disposal of the argument | the spawner's `using arena()` around the spawn, or around a call to a function that spawns, is refused (NL2421) |
| a `Region`, `Secret`, `using` handle or `nish/threads` value inside the argument | refused at the spawn (NL2691) |
| `spawnPiped` writing into a shared array | NL2615, as `push` |

**Loose ends.** A binary whose program spawns nothing has no `nish_async`
symbol: `build.sh` links `runtime-async.c` only when the IR declares one, and
`tests/run.js` checks it. `tests/nish-cmp.js` compiles the corpus with the
seed, which does not know what the release after it ships: the 0.37.0 seed
refuses an object or function argument to `spawn`. Such a program is not
skipped. `compare` reports it as an `exit` difference ("the candidate
compiles it and the reference refuses it"), and four `DECLARED` entries,
one per program and each naming only that `exit` surface, cover
`async_spawn_fn_arg`, `async_spawn_shared`,
`tests/link/async_spawn_shared_outlives` and
`docs/cookbook/async-spawn-shared.ts`. They name this release's note
("a spawned task may reach the objects its spawner owns") and go at the
reseed that ships it, when the seed compiles them and they match nothing.

## Not in this work package

- Promises as values: arrays of them, `Promise.all` over an array, `.then`.
- Moving a waiting task to another process or thread. A task's frame and
  region point into its process's memory. Spreading load is done per
  connection (§6 item 2), and heavy CPU work goes to a job worker over
  `nish/sync/ring` (`examples/prefork-jobs.ts`).
- `async` iterators and `for await`.
- `async` on `--profile wasm`.
- The handler over HTTP/2 and HTTP/3 (WP43). `serve` starts on HTTP/1.1, as
  the handler did.
