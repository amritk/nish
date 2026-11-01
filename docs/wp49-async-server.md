# WP49: `async`/`await` on the server, and the TechEmpower top

**Status: proposed; D1 accepted.** Nothing here is built. The anchors below
are at `a9fcb8d`. [LANGUAGE.md](LANGUAGE.md) stays normative; the API in this
note is a proposal and is not compiled by `npm test`. This note reopens
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
  if (res === null) { return Response.status(502) }
  const body = await res.text()
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

- `fetch` drives `nish/net/http1-client`'s request writer and response
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
cache, must not point into the task's region. WP46 stage 2's rules (NL2422,
NL2557) already refuse that for
`region(...)` blocks, and a task is a region block whose extent ends at the
task's end. A program that wants a value to outlive the task copies it out.

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

## 10. Stages

Each stage is one pull request, with the work each one needs:
[ARCHITECTURE.md](ARCHITECTURE.md) "How to add a construct" for stage 4, a
`docs/security/` record for anything that reads the network, and a guide
page for anything a user sees.

| Stage | What | Waits for |
| --- | --- | --- |
| 1 | The renames of §8, old paths removed | — |
| 2 | `nish/net/upstream` (§7) and the Postgres pool and carrier (WP39 E6), explicit style, each on the handler's loop | — |
| 3 | TFB `db`, `query`, `update`, `cached-query` and `fortune` on stage 2 (WP39 E7, E8); prefork pinning and connection steering (§6 item 2) | 2 |
| 4 | The language: `async`, `await`, `Promise<T>` as a return type, `spawn`, `awaitAll`, the no-recursion rule, the frame lowering of §3, the emitted TypeScript, and the declared differences | WP46 stages 1–2 |
| 5 | The executor (`runtime-async.c`, `nish:async`), `serve`, async `fetch`, the async Postgres pool | 4 |
| 6 | The TFB entry rewritten in the `async` style, held to §6's gate against stage 3's | 3, 5 |

`src/` may use none of this until a release ships it (CLAUDE.md, the rolling
freeze), and the compiler has no reason to.

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
