# An API server

`nish/net/handler` answers HTTP/1.1 requests. It owns the readiness loop, the
connections and everything between a request's first byte and its response's
last: it accepts, routes each request through a
[`Router`](http-router.md) as soon as its head arrives, gathers its body, and
hands your program the request once it is whole. Your program reads it and
answers it. Keep-alive, pipelining, chunked bodies, `HEAD`, timeouts and the
body cap are taken care of.

You do not register a callback per route. Your program *pulls*: `wait` runs
one turn of the loop, `ready` and `take` give out the requests it made whole,
and you dispatch on `req.route` — the number `Router.add` answered, or a
negative `ROUTER_*` code — with a `switch`. An `async` program that would rather hand each request to a function
of its own, in a task that may await, uses [an async server](async-server.md).

## A first server

The examples on this page build with
[`--allow-panics`](cli.md#asking-what-a-program-can-do): `nish/net/handler`,
`nish/net/router` and the JSON reads keep panic sites no proof removes yet, so
a call to them is refused by default until the standard library is made
panic-free.

<!-- allow-panics: calls `std/net/handler.ts`, `std/net/router.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import { HandlerLimits, HttpHandler } from "nish/net/handler";
import { Router, RouterLimits } from "nish/net/router";
import { tcpListen } from "nish:net";

// The routes, in the order they are added: `add` answers 0, 1.
const HELLO: i32 = 0;
const USER: i32 = 1;

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

export const main = (): i32 => {
  const router = new Router(new RouterLimits());
  router.add("GET", "/");
  router.add("GET", "/users/:id");
  const listener: i32 = tcpListen("127.0.0.1", 8080, 1024);
  if (listener < 0) {
    console.error(`cannot listen: ${listener}`);
    return 1;
  }
  const h = new HttpHandler(new HandlerLimits(), listener, router);
  const text = bytesOf("text/plain");
  const hello = bytesOf("hello\n");
  while (true) {
    h.wait(1000);
    while (h.ready()) {
      const req = h.take();
      switch (req.route) {
        case HELLO:
          h.send(req, 200, text, hello, 0, toI32(hello.length));
          break;
        case USER: {
          const id: i32 = req.paramDecimal(0);
          if (id < 0) {
            h.problem(req, 400, "Bad Request", "the id is a number");
            break;
          }
          const w = h.json();
          w.beginObject();
          w.key("id");
          w.i32(id);
          w.endObject();
          h.sendJson(req, 200);
          break;
        }
        default:
          h.refuse(req); // 404, or 405 with its Allow
      }
    }
  }
};
```

`curl localhost:8080/users/7` answers `{"id":7}`; `curl -X POST
localhost:8080/` answers 405 with `Allow: GET, HEAD`; any other path a 404.
Both refusals are [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problems,
`application/problem+json`.

## Reading a request

Everything a request holds is a range of bytes in its own buffers, `req.head`
(the request line and the fields) and `req.body` (`req.bodyLength` bytes), and
stays valid until you answer it. Nothing is copied unless you ask.

| You want | Call |
| --- | --- |
| the method or path, compared | `req.methodIs("POST")`, `req.pathIs("/health")` |
| route parameter `k` | `req.paramStart(k)`, `req.paramEnd(k)` into `req.head`; `req.paramIs(k, "me")`; `req.param(k, out)` percent-decodes into `out`; `req.paramDecimal(k)` is the number, or -1 |
| a query value | `req.query("name", out)` form-decodes into `out`; `req.hasQuery("name")`; `req.queryIndex("name")` sets `req.queryValueStart` and `req.queryValueEnd` |
| a field | `req.header("content-type")` answers its index, or `HANDLER_ABSENT`; `req.valueStart(i)`, `req.valueEnd(i)`; `req.headerIs("accept", "application/json")` |

A decoded parameter or query value can hold any byte, `/`, `..` and NUL
among them; check it before you use it as a file name.

## Answering

Every request you take is answered exactly once:

- `h.send(req, status, contentType, body, off, len)` sends a body you hold.
- `h.sendFields(req, status, names, values, body, off, len)` adds your own
  fields.
- `h.empty(req, status)` sends no body (a 204, say).
- `h.json()` gives the handler's JSON writer, cleared; write one value, then
  `h.sendJson(req, status)`. A value that outgrew `HandlerLimits.jsonBytes`
  is answered 500 instead.
- `h.problem(req, status, title, detail)` sends an RFC 9457 problem. One too
  large for `jsonBytes` is sent without its detail.
- `h.refuse(req)` answers a request no route took: 404, or 405 with `Allow`.
- `h.start(req, status, names, values, length)`, then `h.write(req, buf, off,
  len)` as often as you like, then `h.end(req)`, streams a body; a length of
  -1 sends it chunked.

The handler writes `Content-Length`, `Transfer-Encoding`, `Connection` and
`Date` itself; naming one of the first four yourself, a status outside 200 to
599, more or less body than the length said, or `sendJson` with no `json()`
before it, panics, as a bug in your program.

**A request may be answered later**, after a database answers, say: keep it
and answer it in a later turn. If its client has gone in the meantime, the
answer returns `HANDLER_DROPPED` and sends nothing, even when a new connection
has taken the old one's place. Either way the request goes back to the
handler's pool, so do not keep it after answering.

## Steps before and after a route

Some work belongs to many routes: checking a token, tagging every answer with
a request id. A *step* does it once. `router.step()` names one and answers
its id, 0 for the first; `router.use(route, step)` binds it to a route, or to
`ROUTER_NOT_FOUND` or `ROUTER_METHOD_NOT_ALLOWED` for the requests no route
answers. A table names at most `ROUTER_MAX_STEPS` (31); past that `step`
answers `ROUTER_FULL`.

Steps are pulled, like requests. `h.before(req)` answers the next step bound
to `req.route`, lowest id first, then `HANDLER_NEXT` once all have run, or
`HANDLER_ANSWERED` once one has answered the request. Run the route body only
on `HANDLER_NEXT`. Once the body has chosen its answer, `h.after(req)` hands
out the steps that ran, highest id first, before you send it:

<!-- allow-panics: calls `std/net/handler.ts`, `std/net/router.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import { HANDLER_ABSENT, HANDLER_NEXT, HandlerLimits, HttpHandler } from "nish/net/handler";
import { Router, RouterLimits } from "nish/net/router";
import { tcpListen } from "nish:net";

const HELLO: i32 = 0;
const ADMIN: i32 = 1;

const bytesOf = (text: string): u8[] => {
  const out: u8[] = [];
  for (let i: i32 = 0; i < toI32(text.length); i++) {
    out.push(toU8(text.charCodeAt(i)));
  }
  return out;
};

export const main = (): i32 => {
  const router = new Router(new RouterLimits());
  router.add("GET", "/");
  router.add("GET", "/admin");
  const AUTH: i32 = router.step();
  const SERVED: i32 = router.step();
  router.use(ADMIN, AUTH);
  router.use(HELLO, SERVED);
  router.use(ADMIN, SERVED);
  const listener: i32 = tcpListen("127.0.0.1", 8080, 1024);
  if (listener < 0) {
    return 1;
  }
  const h = new HttpHandler(new HandlerLimits(), listener, router);
  const text = bytesOf("text/plain");
  const hello = bytesOf("hello\n");
  const servedBy = bytesOf("x-served-by");
  const name = bytesOf("nish");
  while (true) {
    h.wait(1000);
    while (h.ready()) {
      const req = h.take();
      let s: i32 = h.before(req);
      while (s >= 0) {
        if (s === AUTH && req.header("authorization") === HANDLER_ABSENT) {
          h.problem(req, 401, "Unauthorized", "send a token");
        }
        s = h.before(req);
      }
      if (s !== HANDLER_NEXT) {
        continue; // a step answered it
      }
      let a: i32 = h.after(req);
      while (a >= 0) {
        if (a === SERVED) {
          h.field(req, servedBy, name);
        }
        a = h.after(req);
      }
      switch (req.route) {
        case HELLO:
        case ADMIN:
          h.send(req, 200, text, hello, 0, toI32(hello.length));
          break;
        default:
          h.refuse(req);
      }
    }
  }
};
```

`curl -i localhost:8080/admin` answers 401, and without `x-served-by`: a step
that answers ends the request, so no step after it runs. With an
`Authorization` field it answers 200 and `x-served-by: nish`, as `/` does.

A step reads the request and does one of two things. It answers it, with
`refuse`, `problem`, `empty` or any other answer, and the route body does not
run. Or it adds a field to the answer with `h.field(req, name, value)`, sent
after the answer's own fields, whichever answer the body sends; at most
`HANDLER_MAX_ADDED` (16) to one answer, and a 17th panics. The handler keeps
`name` and `value` by reference until the answer starts, so give it arrays
you do not change before then. A route bound to no step answers
`HANDLER_NEXT` at once from both calls, and the loop costs it nothing else.
Only a request `take` hands over runs steps: the answers the handler sends
itself, to a malformed or oversized request, a timeout or a full pool, run
none.

## Limits

`HandlerLimits` holds what the handler refuses past:

| Field | Default | Past it |
| --- | --- | --- |
| `http.maxBody` | 1 MiB | the request is answered 413 and its connection ends |
| `bodyTimeout` | 30 000 ms | a body still arriving that long after its head ends its connection |
| `slots` | 256 | a new connection is accepted and closed at once |
| `jsonBytes` | 64 KiB | `sendJson` answers 500 |
| `maxEvents` | 256 | readiness events wait for the next turn |
| `ring` | false | not a limit: open the listener with `limits.listen`, and on Linux it takes connections into io_uring slots, so `slots` may pass the descriptor limit; a kernel that refuses rings serves descriptors, and `netRingState()` says why ([networking](networking.md#more-connections-than-descriptors-net_listen_ring)) |

When the process runs out of descriptors, or a ring listener out of slots, a
waiting connection stays in the listener's backlog: the handler stops
accepting until a connection closes or 100 ms pass, rather than spin.
`h.resting()` is true while it does.

`http` is the HTTP/1.1 carrier's own configuration (`Http1Config`): its head
size and field count caps, its head timeout and its idle timeout. The idle
timeout restarts on every byte, so `bodyTimeout` is what stops a client that
sends its body one byte at a time. Each slot
keeps a body buffer as large as the largest body it has held, so a server
holds at most `slots` times `http.maxBody` in bodies. Once warm, a request
allocates nothing.

## Stopping gracefully

`h.watch(fd, id)` adds one of your own descriptors to the loop, and
`h.fired(id)` says whether it was ready in the last `wait`. With
`signalFd()` from `nish:process`, SIGINT and SIGTERM become a descriptor:

```ts
const signals: i32 = signalFd();
h.watch(signals, 0);
while (!h.fired(0)) {
  serve(h, 1000); // wait, take, answer
}
h.drain();
while (h.connections() > 0) {
  serve(h, 100);
}
netClose(listener);
```

`drain` stops accepting, closes each idle connection at once, and closes each
busy one once the request on it is answered and sent: that answer says
`Connection: close`, and a request pipelined behind it is not read. A request already read
is still handed over, so answer what `take` gives you until `connections()`
is 0. Put a deadline on that second loop if a client may never read its
answer.

## A whole example

`examples/http-app` is a JSON notes API on this page's pieces: command-line
flags, a log line a request, problems for bad input, and the graceful stop
above with a deadline. Build it with `nish examples/http-app/main.ts --allow-panics
--link http-app` (its header says which panic sites it keeps) and run `./http-app 8080`. Copy it and change it: logging and
configuration are left to the example because every server wants them a
little differently.

The handler speaks HTTP/1.1 only. For HTTP/2 and HTTP/3, drive
`nish/net/http2-tls` and `nish/net/http3-server` directly, routing with the
same table ([HTTP routing](http-router.md#from-http11-http2-and-http3)).

`Http3Server` times its own clients: a connection with no request open past
`Http3Config.idleTimeout` (60 s by default) is closed with H3_NO_ERROR, and
one still sending a request's head past `headTimeout` (30 s) with
H3_EXCESSIVE_LOAD. A body that trickles after its head is the handler's to
time, as `bodyTimeout` does for HTTP/1.1.
