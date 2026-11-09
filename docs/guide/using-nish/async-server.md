# An async server

`nish/net/serve` answers HTTP/1.1 requests from an `async` program, one
request per task. You write one `async` function that takes a `Request` and
gives back a `Response`; `serve` runs the loop, routes each request through a
[`Router`](http-router.md), and calls your function in a task of its own for
every request that arrives whole. While a request's task awaits — a sleep, a
socket, another service — the server goes on taking and answering others.

It is built on the pull-style [API server](api-server.md) handler, which it
drives for you: keep-alive, pipelining, chunked bodies, `HEAD`, the timeouts
and the 404 and 405 answers are the handler's, and behave as that page says.
Reach for `nish/net/handler` directly when the program is not `async`, or
answers every request without waiting on anything.

The rules for `async`, `await` and `spawn` are in
[Async functions](../language/async.md).

## A first server

```ts nish:ok
import { Request, Response, ServeLimits, refuse, serve } from "nish/net/serve";
import { Router, RouterLimits } from "nish/net/router";
import { sleep } from "nish:async";

// The routes, in the order they are added: `add` answers 0, 1, 2.
const HOME: i32 = 0;
const USER: i32 = 1;
const ECHO: i32 = 2;

async function handle(req: Request): Promise<Response> {
  switch (req.route) {
    case HOME:
      return new Response(200).text("hello\n");
    case USER: {
      if (req.paramMalformed(0)) {
        return new Response(400).text("a bad escape\n");
      }
      await sleep(5); // the loop answers other requests meanwhile
      return new Response(200).json(`{"id":${req.paramNumber(0)}}`);
    }
    case ECHO:
      return new Response(201).text(req.text());
    default:
      return refuse(req); // 404, or 405 with its Allow
  }
}

export async function main(): Promise<i32> {
  const router = new Router(new RouterLimits());
  router.add("GET", "/");
  router.add("GET", "/users/:id");
  router.add("POST", "/echo");
  return await serve(8080, router, new ServeLimits(), handle);
}
```

`serve(port, router, limits, handle)` listens on every address at `port`
and does not return while it serves. It answers 0 once it stops (see
[Stopping](#stopping)).

## Reading a request

A `Request` is the task's own copy of the request: reading it never touches
another request's memory.

| Member | What it gives |
| --- | --- |
| `route` | The number `Router.add` answered for the route that matched, or a negative `ROUTER_*` code when none did |
| `method()` | The method, as sent: `"GET"`, `"POST"`, ... |
| `path()` | The path, without the query |
| `param(k)` | Route parameter `k` (0 is the first `:name`), percent-decoded; `""` when malformed. A `k` the route does not have panics, as it does for the two below |
| `paramNumber(k)` | Parameter `k` as a decimal number, or -1 when it is not one |
| `paramMalformed(k)` | Whether parameter `k` held a bad `%` escape |
| `query(name)` | The first query value named `name`, form-decoded; `""` when there is none |
| `header(name)` | The value of the first field named `name`, which you give in lowercase; `""` when absent |
| `text()` | The body, as a string; `""` when there is none |

## Answering

Make a `Response` with its status and give it one body:

| Builder | Content type |
| --- | --- |
| `new Response(s).text(str)` | `text/plain; charset=utf-8` |
| `new Response(s).json(str)` | `application/json` |
| `new Response(s).bytes(type, buf, off, len)` | `type`, with `len` bytes of `buf` from `off`; an empty `type` sends the body with no `Content-Type` |
| `new Response(204)` | none, and no body |

`refuse(req)` answers a request no route took the way the router says: 404,
or 405 with an `Allow` listing the methods the path does take, both as an
RFC 9457 problem.

A response whose status is outside 200 to 599, whose body is larger than
`responseBytes`, or whose content type is longer than 128 bytes or holds a
line break or another control character is not sent as written: the client
is answered 500 instead. A 204 or 304 goes without its body.

## Reaching the program's state

A handler written as an arrow inside `main` may use what `main` made: a
counter object, a cache, the async Postgres pool. Every request's task
shares those objects with `main`, in place, so a handler reads and updates
their numbers and awaits a pooled query, and builds its answer in its own
memory:

```ts nish:ok
import { Request, Response, ServeLimits, refuse, serve } from "nish/net/serve";
import { Router, RouterLimits } from "nish/net/router";
import { secret, wipe } from "nish:secret";
import { PgConfig, pgTarget } from "nish/net/postgres";
import {
  PgAsyncParams, PgAsyncPool, pgAsyncClaim, pgAsyncConnect, pgAsyncQuery, pgAsyncRelease,
} from "nish/net/postgres-async";

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  const n: i32 = toI32(text.length);
  for (let i: i32 = 0; i < n; i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

class Stats {
  served: i32 = 0;
}

export async function main(): Promise<i32> {
  const config = new PgConfig();
  config.user = "app";
  const pool = new PgAsyncPool(4);
  const password = secret(bytesOf("app password"));
  await pgAsyncConnect(pool, config, password, pgTarget("127.0.0.1", 5432));
  wipe(password);
  const stats = new Stats();
  const router = new Router(new RouterLimits());
  router.add("GET", "/articles/:id");
  return await serve(8080, router, new ServeLimits(), async (req: Request): Promise<Response> => {
    if (req.route !== 0 || req.paramMalformed(0)) {
      return refuse(req);
    }
    stats.served = stats.served + 1;
    const ticket: i32 = await pgAsyncClaim(pool);
    if (ticket < 0) {
      return new Response(503).text("no connection\n");
    }
    const params = new PgAsyncParams();
    params.int(req.paramNumber(0));
    const r = await pgAsyncQuery(pool, ticket, "select title from article where id = $1", params);
    pgAsyncRelease(pool, ticket, r.reusable);
    if (!r.ok() || r.rows === 0) {
      return new Response(404).text("no such article\n");
    }
    return new Response(200).text(r.text(0, 0));
  });
}
```

What the arrow captures is checked as a spawned task's function argument
([Async functions](../language/async.md)): numbers, booleans, enums, and
objects or arrays a task may share. A handler that stores its own memory
into a shared object (`stats.last = req`), grows a shared array, or hands
one to a further `spawn` is refused, because the task's memory is freed
when the request is answered. Keep what must outlive a request in numbers,
or in the database.

## Order and pipelining

A client that sends several requests on one connection without waiting gets
the answers in the order it sent them: the server reads a connection's next
request only once the one before it is answered, so a later request's task
starts only after the earlier answer is sent. Requests on one connection run
one at a time; two clients never wait on each other.

## Limits

`ServeLimits` holds every cap, set before `serve`:

| Field | Default | Past it |
| --- | --- | --- |
| `connections` | 256 | A new connection is closed as it is accepted |
| `inFlight` | 256 | The request is answered 503 |
| `headerBytes` | 16,384 | 431, and the connection ends |
| `bodyBytes` | 1,048,576 | 413, and the connection ends |
| `responseBytes` | 65,536 | 500 instead of the response |
| `deadline` | 30,000 | Milliseconds a request's task may run; the task is cancelled (see below) |
| `headTimeout` | 30,000 | Milliseconds for a whole request head; the connection is closed |
| `idleTimeout` | 60,000 | Milliseconds with no byte read or written; the connection is closed |
| `maxRequests` | 0 (none) | The server stops (see below) |

Each request's task runs in a memory region of its own, and everything it
allocates goes when it answers, so the server's arena stays flat however many
requests it answers.

<a id="cancellation" style="scroll-margin-top: 65px"></a>

## When a task is cancelled

The server cancels a request's task when its client hangs up, when its
`deadline` passes and when the server stops. A cancel never stops your
handler mid-line: every `await` it is parked on answers `false` at once, and
so does every one it makes later, so the handler runs on to its end, its
`using` bindings are disposed and its region is freed. Check `cancelled()`
from `nish:async` after an `await` that failed, and answer:

```ts nish:ok
import { cancelled, sleep } from "nish:async";
import { Request, Response } from "nish/net/serve";

async function slow(req: Request): Promise<Response> {
  const slept = await sleep(5000);
  if (!slept && cancelled()) {
    return new Response(503).text("past the deadline");
  }
  return new Response(200).text("done");
}

export const main = (): i32 => 0;
```

- **A hang-up**: nobody reads the answer, so it is dropped.
- **The deadline**: the answer is sent, and the connection goes on.
- **A stop**: the answer is sent with `Connection: close`.

The async `fetch` answers a cancelled wait with `HTTP_E_CANCELLED`, and the
async Postgres pool fails a cancelled claim with -3, so a handler that awaits
either ends as quickly. A handler that computes for a long time without an
`await` is not reached until it awaits.

<a id="stopping" style="scroll-margin-top: 65px"></a>

## Stopping

With `maxRequests` above 0, the server stops taking requests once it has
answered that many: each connection is answered what it already sent, told
`Connection: close`, and closed, every task still running is cancelled, and
`serve` returns 0 when none is left.

## Running it

A server is a native program: `readable` and `writable` in `nish:async`,
which the server waits on, are refused by `nish --emit-ts` with NL4017, and
the cancellation calls with NL4018
([Async functions](../language/async.md)), so a program that serves cannot be
turned into TypeScript.
