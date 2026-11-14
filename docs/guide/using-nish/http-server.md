# One server for HTTP/1.1, 2 and 3

`nish/net/http-server` answers HTTP/1.1, HTTP/2 (over TLS or cleartext) and
HTTP/3 from one loop and one routing switch. You configure a listener for
each version you serve; every request, whichever version carried it, comes out of the same
`take` with the same fields, and one route body answers all three. Once an
HTTP/3 listener is configured, every HTTP/1.1 and HTTP/2 response carries an
`Alt-Svc` field naming its port, so a browser moves to HTTP/3 on its own.

It is the pull loop of [an API server](api-server.md) over several carriers:
`wait` runs one turn, `ready` and `take` hand out the requests it made whole,
and you `switch` on `r.route`, the number [`Router.add`](http-router.md)
answered. Reach for `nish/net/handler` when you serve HTTP/1.1 alone and want
its chunked request bodies, or [an async server](async-server.md) when each
request should run in a task of its own. Like `nish:net`, this module is
native only.

## A first server

```ts nish:ok
import { HttpServer, HttpServerLimits } from "nish/net/http-server";
import { Http1Config } from "nish/net/http1-server";
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
  const server = new HttpServer(new HttpServerLimits(), router);
  server.listenHttp1(listener, new Http1Config(), 256);
  const text = bytesOf("text/plain");
  const hello = bytesOf("hello\n");
  while (true) {
    server.wait(1000);
    while (server.ready()) {
      const r = server.take();
      switch (r.route) {
        case HELLO:
          server.send(r, 200, text, hello, 0, toI32(hello.length));
          break;
        case USER: {
          const id: i32 = r.paramDecimal(0);
          if (id < 0) {
            server.problem(r, 400, "Bad Request", "the id is a number");
            break;
          }
          const w = server.json();
          w.beginObject();
          w.key("id");
          w.i32(id);
          w.endObject();
          server.sendJson(r, 200);
          break;
        }
        default:
          server.refuse(r); // 404, or 405 with its Allow
      }
    }
  }
};
```

`curl localhost:8080/users/7` answers `{"id":7}`; a path no route has
answers 404 and a known path with another method 405, both as
[RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) problems.

## Adding HTTP/2 and HTTP/3

HTTP/2 is served over TLS (ALPN `h2`) on a TCP socket, and HTTP/3 over QUIC on
a UDP socket. Each listener takes the socket you made, and stays yours to
close:

```ts
server.listenHttp1(tcpFd, new Http1Config(), 256);
server.listenHttp2Tls(tlsFd, tls, new Http2Config(), 64);
server.listenHttp3(udpFd, quic, new Http3Config(), 64, entropy);
for (;;) {
  server.waitSigned(1000, key); // signs each handshake with the certificate's key
  while (server.ready()) {
    answer(server, server.take());
  }
}
```

- `tls` is a `TlsServerConfig` (`nish/net/tls`): the certificate chain, leaf
  first, ALPN `["h2"]` and the signature scheme of your key.
- `quic` is a `QuicServerConfig` (`nish/net/quic`), and `entropy` the random
  bytes the QUIC listener keys its own secrets with
  (`QUIC_LISTENER_ENTROPY_SIZE` of them).
- `key` is the certificate's P-256 private key, a
  [`Secret`](standard-library.md#nishsecret). `waitSigned` borrows it for the
  call; it stays yours to wipe. A server with only HTTP/1.1 and h2c
  listeners calls `wait`, which takes no key; `wait` panics once a TLS or
  QUIC listener is configured.

The `Alt-Svc` field reads `h3=":<port>"; ma=86400`: the UDP socket's own
port, or `HttpServerLimits.altSvcPort` when a proxy in front of you
publishes another. With `altSvcMaxAge` 0 every HTTP/1.1 and HTTP/2
over TLS response says `alt-svc: clear` instead, so clients forget an
earlier advertisement. A
response whose fields already name an `alt-svc` keeps yours. An HTTP/3
response carries none.

### Cleartext HTTP/2

`server.listenH2c(fd, new Http2Config(), slots)` serves HTTP/2 without TLS on a
TCP listener, to clients that already know it speaks HTTP/2 (prior
knowledge: the client opens with the 24-byte preface). There is no
`Upgrade: h2c` from HTTP/1.1. Its requests come out of `take` like the rest,
with `r.version` 2 and `r.secure` false, and carry no `alt-svc`. A
connection that has not sent its preface within `prefaceTimeout` is closed,
and after the preface `idleTimeout` applies as on HTTP/2 over TLS.

Nothing on an h2c connection is encrypted or authenticated. Serve it only
behind a proxy that ends TLS for you, or on a network you trust.

## Reading a request

A request holds the same fields on every version. `r.head` holds its method,
target and fields, copied once out of the connection; `r.body` holds
`r.bodyLength` bytes of body. Both stay valid until you answer it.
`r.version` is 1, 2 or 3, and `r.secure` says whether it came over TLS or
QUIC: false on HTTP/1.1 and h2c.

| You want | Call |
| --- | --- |
| the method or path, compared | `r.methodIs("POST")`, `r.pathIs("/health")` |
| route parameter `k` | `r.paramStart(k)`, `r.paramEnd(k)` into `r.head`; `r.paramIs(k, "me")`; `r.param(k, out)` percent-decodes into `out`; `r.paramDecimal(k)` is the number, or -1 |
| a query value | `r.query("name", out)` form-decodes into `out`; `r.hasQuery("name")`; `r.queryIndex("name")` sets `r.queryValueStart` and `r.queryValueEnd` |
| a field | `r.header("content-type")` answers its index, or `HANDLER_ABSENT`; `r.valueStart(i)`, `r.valueEnd(i)`; `r.headerIs("accept", "application/json")` |

A field name is matched without regard to case on every version. A decoded
parameter or query value can hold any byte, `/`, `..` and NUL among them;
check it before you use it as a file name.

## Answering

Every request you take is answered exactly once, through the server you took
it from:

- `server.send(r, status, contentType, body, off, len)` sends a body you hold.
- `server.sendFields(r, status, names, values, body, off, len)` adds your own
  fields.
- `server.empty(r, status)` sends no body.
- `server.json()` gives the server's JSON writer, cleared; write one value,
  then `server.sendJson(r, status)`.
- `server.problem(r, status, title, detail)` sends an RFC 9457 problem.
- `server.refuse(r)` answers a request no route took: 404, or 405 with
  `Allow`.
- `server.start(r, status, names, values, length)`, then
  `server.write(r, buf, off, len)` as often as you like, then
  `server.end(r)`, streams a body. A length of `HTTP1_CHUNKED` sends one of
  unknown length: chunked on HTTP/1.1, plain DATA frames on HTTP/2 and
  HTTP/3.

Each returns `HANDLER_SENT`, or `HANDLER_DROPPED` when the client has gone:
its connection closed, or its HTTP/2 or HTTP/3 stream was reset. Either way
the request goes back to the server's pool, so do not keep it after
answering. `server.hungUp(r)` asks the same question before you answer, for
a request you hold while another service works. On HTTP/1.1 and HTTP/2 it
is true once the client's side of the connection has ended, which includes a
client that half-closed TCP after sending its request and may still read
the answer; `send`'s result says whether it did.

On HTTP/2 and HTTP/3, field names are lowercase. The server writes the
length and connection fields itself. A status outside 200 to 599, more or
less body than the length said, a request answered twice, or one answered
through another server, panics, as a bug in your program.

## Limits

`HttpServerLimits` holds what the server refuses past. Each listener checks
its carrier's own caps against them when you configure it, and panics on one
that would let in more:

| Field | Default | Past it |
| --- | --- | --- |
| `requests` | 1024 | the pool every version shares is full: see below |
| `maxBody` | 1 MiB | the request is answered 413 |
| `maxHead` | 32 KiB | the request is answered 431 |
| `maxFields` | 100 | the request is answered 431 |
| `maxResponseFields` | 32 | the response is not sent; the request answers `HANDLER_DROPPED` |
| `bodyTimeout` | 30 000 ms | a body still arriving that long after its head ends its request |
| `idleTimeout` | 60 000 ms | an HTTP/2 connection, over TLS or h2c, with no open stream closes |
| `prefaceTimeout` | 10 000 ms | an h2c connection that has not sent its preface closes |
| `jsonBytes` | 64 KiB | `sendJson` answers 500 |

An HTTP/1.1 connection is held to its own `Http1Config` caps as well, which
may be tighter: a target past its `maxTarget` is answered 414.

With the pool full, an HTTP/1.1 connection stops being read until a request
is free, an HTTP/2 stream is refused with `REFUSED_STREAM` and an HTTP/3 one
with `H3_REQUEST_REJECTED`, both of which a client may retry. No one
connection holds more than a quarter of the pool, and never fewer than
one request (so at `requests` 1 to 3, one each), so one client cannot
starve the rest. Each request keeps a head buffer of `maxHead` bytes, made
the first time it is used, and holds its body whole. A body grows in steps:
up to `T`, the smaller of 64 KiB and `maxBody`, it doubles; past `T` it moves
once into an array of exactly `maxBody`. So the bodies a server holds stay
below `requests` times `maxBody + 3T`, beside the heads.

## Stopping gracefully

`server.watch(fd, id)` and `server.fired(id)` add your own descriptors to the
loop, as the [API server](api-server.md#stopping-gracefully) shows with
`signalFd()`. Then:

```ts
server.drain();
while (server.connections() > 0) {
  turn(server, 100); // waitSigned, take, answer
}
```

`drain` stops accepting, closes each idle HTTP/1.1 connection at once and
each busy one after its answer, and sends `GOAWAY` on each HTTP/2 and HTTP/3
connection, which closes once its streams are done. A request already read is
still handed over, so answer what `take` gives you until `connections()` is
0.

The library reference lists every declaration:
[`nish/net/http-server`](../../reference/net/http-server.md). What the
module was reviewed for is its
[security record](../../security/http-server.md).
