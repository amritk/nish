# An API server

`nish/net/handler` answers HTTP/1.1 requests. It owns the readiness loop, the
connections and everything between a request's first byte and its response's
last: it accepts, routes each request through a
[`Router`](http-router.md) as soon as its head arrives, gathers its body, and
hands your program the request once it is whole. Your program reads it and
answers it. Keep-alive, pipelining, chunked bodies, `HEAD`, timeouts and the
body cap are taken care of.

Nish has no function values, so you do not register a callback per route.
Your program *pulls*: `wait` runs one turn of the loop, `ready` and `take`
give out the requests it made whole, and you dispatch on `req.route` — the
number `Router.add` answered, or a negative `ROUTER_*` code — with a
`switch`.

## A first server

```ts nish:ok
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

## Limits

`HandlerLimits` holds what the handler refuses past:

| Field | Default | Past it |
| --- | --- | --- |
| `http.maxBody` | 1 MiB | the request is answered 413 and its connection ends |
| `bodyTimeout` | 30 000 ms | a body still arriving that long after its head ends its connection |
| `slots` | 256 | a new connection is accepted and closed at once |
| `jsonBytes` | 64 KiB | `sendJson` answers 500 |
| `maxEvents` | 256 | readiness events wait for the next turn |

When the process runs out of descriptors, a waiting connection stays in the
listener's backlog: the handler stops accepting for 100 ms, then tries
again, rather than spin.

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
above with a deadline. Build it with `nish examples/http-app/main.ts --link
http-app` and run `./http-app 8080`. Copy it and change it: logging and
configuration are left to the example because every server wants them a
little differently.

The handler speaks HTTP/1.1 only. For HTTP/2 and HTTP/3, drive
`nish/net/http2-tls` and `nish/net/http3-server` directly, routing with the
same table ([HTTP routing](http-router.md#from-http11-http2-and-http3)).
