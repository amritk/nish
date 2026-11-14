# WP54: `async` on wasm, with the page as the executor

**Status: proposed, design only.** Nothing in the compiler, the runtime,
`std/` or the tests changes with this note, and nothing in it is measured
yet: every cost below is stated as what a stage must measure, not as a
figure. [LANGUAGE.md](LANGUAGE.md) stays normative. The anchors are at
`9d59810e`.

Two notes leave `async` on wasm to a note of its own, and this is it.
[wp49-async-server.md](wp49-async-server.md) §4 refuses `async` under the
wasm profiles "until a host loop is designed (WP24 §4.6)", and its "Not in
this work package" repeats it. [wp50-wasm-host.md](wp50-wasm-host.md) keeps
NL2652 and says what would lift it: WP49's fixed-size state machine running on
wasm with the page as its executor, which resolves the promise and calls a
resume export, so that module code can write `await gpuReady()`. Its
"Not in this work package" ends: "It is its own note."

This note proposes that design and asks the owner whether to build it. It
does not argue that it must be built: WP50 already gives a page that drives a
module a complete answer without it (§2), and the case for building it rests
on programs that must run on a host which accepts only JavaScript or wasm
(§1).

## 1. Who needs it

**A service that runs on Cloudflare Workers.** A Worker runs JavaScript or
wasm and nothing else, and its `fetch` handler answers a promise. Take a
service whose every request waits on Postgres, and some of whose requests
also wait on another service over HTTPS. Written in Nish, it has two roads:

- **Native, off Workers.** WP49's `serve`, the async Postgres pool (stage 5,
  part 5) and async `fetch` over TLS (part 6) already carry it, and Postgres
  over TLS is in the carrier (WP39 E6). Nothing in this note is needed.
- **On Workers, as wasm.** Every wait in the handler is a host promise, and
  `async` is refused on wasm (NL2652). Without this note, the handler's
  control flow stays in the Worker's JavaScript and Nish can own only the
  synchronous pieces between its awaits.

Which road a program takes is its own decision. This note is the cost of the
second road.

**A page, for its set-up and connection code only.** A frame path does not
wait: WP50's driven module steps a simulation and builds an instance list in
plain exports, and the page awaits each promise (adapter set-up, a datagram
read, a `fetch`) and calls an export with the result
([wp50-wasm-host.md](wp50-wasm-host.md) §6). That works, and the page needs
nothing here. What it costs is where the *sequence* of waits lives: a join
or reconnect flow (discover a server, open a transport, say hello, wait for
the answer, retry) is written as page TypeScript that calls exports between
awaits, rather than as one Nish `async` function. This note would let it
move. It is a convenience for a page, not a gap.

## 2. What is there today

| | Today | Where |
| --- | --- | --- |
| `async` on the native targets | An `async` function lowers to a frame and a resume switch (`i1 @f.resume(i8*)`); awaited frames nest in their caller's; the executor resumes a task through a generated `switch` on its kind, with no function pointer | [wp49](wp49-async-server.md) §3 |
| The executor | `runtime/runtime-async.c`: a slab of task nodes per spawned kind, wait tokens `(generation << 32) \| (slot + 1)`, a ready queue, and `epoll` or `kqueue` with a timer heap underneath; linked only into a program that declares a `nish_async_` symbol | [wp49](wp49-async-server.md) "Stage 5, part 1" |
| What a task waits on | `readable(fd)`, `writable(fd)` and `sleep(ms)` from `nish:async`, and everything in `std/` written over them | [wp49](wp49-async-server.md) §4 |
| Memory | a region per task, entered around every resume and freed when the task ends; an `awaitAll` lane gets its own | [wp49](wp49-async-server.md) §5, HF-13 |
| `async` on wasm | refused: NL2652 under a `wasm32` target or `--profile wasi` | [LANGUAGE.md](LANGUAGE.md#async-functions-async-and-await) |
| A promise from the page | refused at a host import's signature, with the advice to await it in the page and call an export with the result | [wp50](wp50-wasm-host.md) §3 |
| Re-entry | an export entered while another is on the stack throws `NishReentry` before it touches the module | [wp50](wp50-wasm-host.md) §6 |
| Regions on wasm | not available under the freestanding profiles: there is no `malloc` to give a region its chunks | [wp50](wp50-wasm-host.md) "Not in this work package", `runtime/runtime-region.c` |

So the lowering would carry over as it is. What wasm lacks is the loop
underneath the executor, and the memory each task is given.

## 3. The shape

**A host import may answer a promise.** In the page's host module, an
`async` function whose result is a type WP50 already lets cross (a number, a
boolean, a `HostHandle<K>`, or `void`) becomes an import the module can
await:

```ts
// web/host.ts, the page's own TypeScript
export type Transport = HostHandle<"transport">

export async function transportReady(t: Transport): Promise<i32> {
  await transports[t].ready
  return 0
}
```

```ts
// net.ts, compiled to wasm
import { transportReady } from "./host"

export async function join(t: Transport): Promise<i32> {
  const ready = await transportReady(t)
  if (ready !== 0) {
    return ready
  }
  // ... say hello, then wait for the answer the same way
  return 0
}
```

The await obeys WP49's rules unchanged: it takes a direct call, no expression
has a promise type, and the import's frame does not exist (it is the page's).

**The page is the executor's loop.** On native, `nish_async_next` blocks in
`epoll` when nothing is ready. On wasm it cannot block, so it returns, and the
page's own event loop does the waiting:

1. **An exported `async` function is an entry.** The loader's adapter for
   `join` calls into the module, which makes a task, runs it until it is
   pending or done, and returns. The adapter answers the page a JavaScript
   promise that settles when the task finishes.
2. **A host promise is a wait token.** When the task awaits `transportReady`,
   the module records a token as the native executor does for a descriptor,
   calls the import, and the adapter attaches a reaction to the promise the
   page's function returned. The task's frame is saved and the export
   returns.
3. **A settled promise resumes the module.** The reaction calls one generated
   export, `nish_async_complete(token, value)`. It records the answer, then
   runs every ready task until none is ready, and returns.

A reaction runs from the microtask queue, after the stack that made it has
unwound, so `nish_async_complete` never runs while another export is on the
stack. WP50's re-entry rule holds without an exception. A token whose task has
been cancelled or has finished is dropped by its generation, as ASYNC-1 drops a
late completion on native.

**`spawn` and `awaitAll` keep their meaning.** Several tasks may be pending
at once, each on its own host promise, and each resumes when its own promise
settles. Nothing runs at the same time: the module runs one task at a time,
between the page's turns, as the native executor does between `epoll` waits.

**`sleep` becomes a host wait.** On wasm, `sleep(ms)` is lowered to an import
the loader supplies, a `setTimeout` that settles a promise. `readable` and
`writable` stay refused, because a wasm module has no descriptors. Their
refusal is the one NL2652 gives today, narrowed to those two calls.

**The TypeScript reading is the program as written.** `--emit-ts` keeps the
`import` and the `await`, and under Node or in a browser the awaited call is
the page's own `async` function. The round trip is exact by construction:
both readings call the same JavaScript.

## 4. Memory: the region each task is given

WP49 gives every task a region, and the freestanding wasm profiles have no
region, because a region takes its chunks from `malloc`. This is the one
design question the lowering does not answer, and it has two answers:

- **(a) Regions from a fixed pool.** The region unit takes its chunks from a
  pool carved out of the module's fixed memory at instantiation, sized by a
  cap on tasks in flight that the build names. Memory never grows, so WP50's
  views stay valid for the module's life, as a page wants. A task that
  would pass the cap is refused at its `spawn` with an answer the caller
  reads, never a panic.
- **(b) A `malloc` under `--profile wasm-host`.** Regions work as they do on
  native, and memory grows when the tasks in flight need it. Every growth
  replaces the memory's buffer, and the page rebuilds its views by WP50's
  buffer-identity check. A Worker, which holds no views between requests,
  loses nothing by it.

The recommendation is (a) for a page and (b) for a Worker, chosen by a flag,
but that is the owner's question (§7, Q2). Either way, a program with no
`async` function links none of it: the executor is linked by the same
`nish_async_` grep that links it on native.

## 5. A Worker

A Worker's entry is an object with a `fetch` method, written in JavaScript. The
loader would not generate it. The Worker's own module would import the Nish
module through WP50's loader and call an exported `async` function per request:

```ts
// worker.ts, the Worker's own TypeScript
import { apiBytes, loadSync } from "./api.mjs"
import * as host from "./host"

const api = loadSync(apiBytes, host)

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const req = host.adopt(request, env)
    const status = await api.handle(req)
    return host.respond(req, status)
  },
}
```

This is a sketch: `adopt` and `respond` are functions the host module would
write, and `apiBytes` stands for the module's bytes as WP50's `--inline`
gives them. The host module turns each binding the Worker has (a database connection,
a rate limiter, an outbound `fetch`) into an `async` import over a
`HostHandle`, and the request's body and headers cross as WP50's buffer windows
and strings. Whether the Worker's runtime accepts a module built this way, and
at what cost per request, is what stage 4 measures (§8). This note claims
neither.

## 6. The alternative: JavaScript Promise Integration

JSPI lets a wasm import that returns a promise suspend the whole wasm call
stack until it settles, with no change to how the code is lowered. WP50 left
it out. Its attraction here is that a synchronous Nish function could wait on
the page with no `async` keyword at all.

It is not recommended, for three reasons the owner should weigh against its
simplicity:

- **It breaks the TypeScript reading.** A function that suspends under JSPI is
  synchronous in its source, so its TypeScript reading cannot wait: the same
  program would mean two things.
- **It hides the wait from the checker.** WP49's rules (an `await` on a direct
  call, no recursion through an `await`, a region per task) exist because the
  checker can see every place a task may suspend. Under JSPI any import may
  suspend, and none of those rules can be checked.
- **Where it runs is a fact to check, not to assume.** Whether the browsers a
  page targets, and the Worker runtime, ship it is a question for stage 1's
  survey (§8), not something this note asserts.

## 7. Questions for the owner

| | Question | Recommendation |
| --- | --- | --- |
| **Q1** | Build this at all, or keep the page awaiting and calling exports (WP50 §6) | **Only when a program that must run on a Worker asks for it.** A page does not need it (§1), and a service that can run natively has WP49. Until one asks, keep NL2652 |
| **Q2** | A task's memory on wasm: regions from a fixed pool, or a `malloc` under `wasm-host` (§4) | **Both, by a flag**: the fixed pool for a page, so views never go stale, and `malloc` for a Worker, which holds no views |
| **Q3** | JSPI instead (§6) | **No**, for the TypeScript reading and the checker's view of every wait |
| **Q4** | Which of `nish:async`'s waits exist on wasm | **`sleep` through a loader import**; `readable` and `writable` stay refused |
| **Q5** | Whether the loader generates a Worker's `fetch` entry | **No.** The Worker's module is ordinary TypeScript that calls an export (§5) |

## 8. Stages, if it is built

| Stage | What | Size |
| --- | --- | --- |
| 1 | **A survey and a spike.** Check where JSPI runs (Q3's evidence). Lower one `async` export over one `async` import by hand, on `wasm32`, with the executor's queue split from its `epoll` half, and run it in Node and in Chromium | S |
| 2 | **The executor on wasm.** `runtime-async.c`'s queue and tokens without the poll half; `nish_async_complete`; `async` exports and `async` host imports in the loader and the `.d.ts`; NL2652 narrowed to what stays refused; `sleep` through the loader | M |
| 3 | **A task's memory** by Q2's answer, with its security record | M |
| 4 | **A Worker-shaped example**: a module answering requests over an awaited host `fetch` and an awaited database handle, run under Node and under the Worker runtime in CI, with its cost per request measured against the same handler written in TypeScript | M |

## Not in this work package

- Promises as values: storing one, `.then`, `Promise.all` over an array.
  [wp49](wp49-async-server.md) refuses them on native, and wasm gains nothing
  that would change that.
- Threads on wasm, and `SharedArrayBuffer`.
- Generated bindings for a Worker's platform (KV, queues, rate limits): the
  host module writes those it uses, as a page writes its own.
- A Nish executor that runs without a host loop on wasm, such as busy-waiting
  inside an export. It would block the page's thread.
