# gRPC

`nish/net/grpc` answers gRPC calls, unary and streaming, on the HTTP/2
listeners of [`nish/net/http-server`](http-server.md): HTTP/2
over TLS (`listenHttp2Tls`) and cleartext HTTP/2 (`listenH2c`). A call is a
route like any other: each method is a `POST` to `/<package>.<Service>/<Method>`
that you add to the server's [router](http-router.md). The messages are
protobuf, which you read and write with
[`nish/net/protobuf`](standard-library.md#nishnetprotobuf). It is imported like
any other library module
([`export` and `import`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#export-and-import)).

You can write each message's encode and decode by hand on
`nish/net/protobuf`, as the example below does, or have
[`nish proto`](protobuf-classes.md) write message classes from a `.proto`
file.

## A first service

This service answers `GetSum` from `message SumRequest { int32 a = 1; int32 b
= 2; }` with `message SumReply { int32 result = 1; }`. It builds with
[`--allow-panics`](cli.md#asking-what-a-program-can-do): `nish/net/http-server`
and `nish/net/router` keep panic sites no proof removes yet, so a call to them
is refused by default until the standard library is made panic-free.

<!-- allow-panics: calls `std/net/http-server.ts`, `std/net/router.ts`, `std/net/grpc.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import { GRPC_CALL, GRPC_INVALID_ARGUMENT, GrpcLimits, GrpcServer } from "nish/net/grpc";
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server";
import { Http2Config } from "nish/net/http2";
import { PROTO_OK, ProtoReader, ProtoWriter } from "nish/net/protobuf";
import { Router, RouterLimits } from "nish/net/router";
import { tcpListen } from "nish:net";

// The routes, in the order they are added: `add` answers 0.
const GET_SUM: i32 = 0;

const getSum = (grpc: GrpcServer, out: ProtoWriter, r: HttpServerRequest): void => {
  const msg = new ProtoReader(r.body, grpc.messageStart(r), r.bodyLength);
  let a: i32 = 0;
  let b: i32 = 0;
  while (msg.next()) {
    if (msg.field === 1) {
      a = msg.int32();
    } else if (msg.field === 2) {
      b = msg.int32();
    }
  }
  if (msg.failed !== PROTO_OK) {
    grpc.fail(r, GRPC_INVALID_ARGUMENT, "not a SumRequest");
    return;
  }
  out.reset();
  out.int32(1, a + b);
  grpc.reply(r, out.buf, 0, out.end);
};

export const main = (): i32 => {
  const router = new Router(new RouterLimits());
  router.add("POST", "/calc.Calculator/GetSum");
  const listener: i32 = tcpListen("127.0.0.1", 50051, 1024);
  if (listener < 0) {
    console.error(`cannot listen: ${listener}`);
    return 1;
  }
  const server = new HttpServer(new HttpServerLimits(), router);
  server.listenH2c(listener, new Http2Config(), 256);
  const grpc = new GrpcServer(server, new GrpcLimits());
  const out = new ProtoWriter([]);
  while (true) {
    server.wait(1000);
    while (server.ready()) {
      const r = server.take();
      if (grpc.call(r) !== GRPC_CALL) {
        continue; // `call` has answered it
      }
      switch (r.route) {
        case GET_SUM:
          getSum(grpc, out, r);
          break;
        default:
          server.refuse(r);
      }
    }
  }
};
```

A gRPC client that speaks cleartext HTTP/2 reaches it: with
[grpcurl](https://github.com/fullstorydev/grpcurl) and the `.proto` file,
`grpcurl -plaintext -proto calc.proto -d '{"a": 2, "b": 3}' localhost:50051
calc.Calculator/GetSum` answers `{"result": 5}`. Nish's own CI calls a
`nish/net/grpc` server this way with grpcurl and [ghz](https://ghz.sh), over
TLS and cleartext, and checks its replies, its error statuses and its
deadlines ([the record](https://github.com/amritk/nish/blob/main/docs/security/grpc.md#checked-against-a-stock-client)
lists the checks). Serve real traffic over TLS
with `listenHttp2Tls`, as [One server for HTTP/1.1, 2 and 3](http-server.md#adding-http2-and-http3)
shows. The loop then calls `server.waitSigned(1000, key)` in place of
`server.wait(1000)`, with the certificate's private key as a
[`Secret`](standard-library.md#nishsecret): `wait` panics once a TLS listener
is configured, since it has no key to sign the handshake with. The rest of
the program is the same.

## What `call` answers for you

`grpc.call(r)` reads the request and answers `GRPC_CALL` when it is a call
your program should answer. Otherwise it has already answered it and returns
`GRPC_ANSWERED`, and you move on to the next request:

| The request | The answer |
| --- | --- |
| over HTTP/1.1 or HTTP/3 | `505` |
| a `content-type` other than `application/grpc` or `application/grpc+proto` | `415` |
| a malformed `grpc-timeout` | `INTERNAL` |
| a deadline already past | `DEADLINE_EXCEEDED` |
| a compressed message | `UNIMPLEMENTED` |
| a message longer than `maxMessage` | `RESOURCE_EXHAUSTED` |
| a body that is not one length-prefixed message | `INTERNAL` |

The message of a call starts at `grpc.messageStart(r)` in `r.body` and ends
at `r.bodyLength`, which is what a `ProtoReader` takes.

## Answering

`grpc.reply(r, buf, off, len)` answers `200` with `content-type:
application/grpc`, the message `buf[off, off + len)` with its length prefix,
then `grpc-status: 0` in the trailers. `grpc.fail(r, status, message)` answers
one of the `GRPC_*` statuses 1 to 16 with `message` as its `grpc-message`,
percent-encoded so that any text is safe to send. With an empty message the
answer is one HEADERS frame that carries the status and ends the call
(gRPC's Trailers-Only form). Both return `HANDLER_SENT`, or
`HANDLER_DROPPED` when the client has gone.

A status outside 1 to 16, or a window outside `buf`, panics as a bug in your
program.

## Deadlines

A client may send `grpc-timeout`, the time it will wait for the answer.
`GrpcLimits.maxTimeout` (30 000 ms by default) caps it, so a client cannot
ask for longer, and a call without one gets `maxTimeout` as its deadline.
The deadline is counted from when the server read the request's head.
`call` answers `DEADLINE_EXCEEDED` to a call already past it, and so do
`reply` and `fail` if you answer it late, in place of what you passed.

The deadline is checked only when you call one of them: nothing times a call
out while your program holds it. A service that keeps calls waiting, for a
database or another service, asks `grpc.expired(r)` and answers the stale
ones with `fail(r, GRPC_DEADLINE_EXCEEDED, "")` so their streams close.

## Limits

`GrpcLimits.maxMessage` (4 MiB by default) is the longest message a call may
declare. The server's `HttpServerLimits.maxBody` (1 MiB by default) caps the
body first and answers `413` past it, so a service that takes messages over
1 MiB raises both. A `GrpcLimits` value outside its
range panics when `new GrpcServer` reads it.

What `call` refuses, and the tests that pin each answer, are in its
[security record](https://github.com/amritk/nish/blob/main/docs/security/grpc.md).

Compressed messages are not supported: one is answered `UNIMPLEMENTED`.

## Streaming calls

A streaming method's request, reply or both are a sequence of messages
rather than one. Its route is added like a unary one; what changes is how
your program reads and answers it.

- **Server streaming** (one request, many replies): read the request with
  `call`, as a unary one, then send each reply with `grpc.send(r, buf, off,
  len)` and end the call with `grpc.finish(r, GRPC_OK, "")`.
- **Client streaming** (many requests, one reply) and **bidirectional**:
  mark the route with `server.streamBody(route)`, so `take` hands the call
  over at its head and again each time more of its body arrives. Check it
  once with `grpc.open(r)`, which refuses what `call` refuses, then read
  each message with `grpc.next(r)`.

`next` answers one of four codes:

| `next` returns | It means |
| --- | --- |
| `GRPC_MESSAGE` | A message is in: it is `grpc.messageBytes(r)` from `grpc.messageStart(r)` to `grpc.messageEnd(r)`, until the next call of `next` |
| `GRPC_MORE` | Nothing more yet: go back to your loop until `take` hands `r` over again |
| `GRPC_END` | The client's stream ended: answer with `reply`, or with `send` and then `finish` |
| `GRPC_ANSWERED` | `next` answered the call itself and `r` is the server's again |

`next` answers the call itself on a message longer than `maxMessage`
(`RESOURCE_EXHAUSTED`), a compressed one (`UNIMPLEMENTED`), a body that ends
part way through a message (`INTERNAL`), a passed deadline
(`DEADLINE_EXCEEDED`), and a client that hung up. A message split across
several DATA frames is put back together for you.

`send` never blocks: what the connection cannot take yet is queued, and it
returns the bytes still queued. A program that sends many messages stops
while `server.pending(r)` is above a budget of its own and sends the rest on
a later turn of its loop, so a slow client costs the server that budget, not
the whole answer. Once the call is over, because the client hung up or the
deadline passed, `send` returns `GRPC_ENDED` and `r` is the server's again.
While a call is above its budget the program sends nothing, so it asks
`server.hungUp(r)` and `grpc.expired(r)` itself on each turn and ends a call
that answers yes with `finish`: past the deadline that answers
`DEADLINE_EXCEEDED`, and for a client that hung up it gives `r` back.
`finish(r, status, message)` ends a call with any status; `fail` on a call
whose answer has begun does the same.

This service adds a client-streaming `SumAll`, which replies with the sum of
every `SumRequest` it is sent, and a server-streaming `Count`, which sends
`count` replies from `start` up, from `message CountRequest { int32 count =
1; int32 start = 2; }`:

<!-- allow-panics: calls `std/net/http-server.ts`, `std/net/router.ts`, `std/net/grpc.ts` code that keeps panic sites no proof removes yet -->
<!-- nish:ok --allow-panics -->
```ts
import {
  GRPC_CALL,
  GRPC_END,
  GRPC_ENDED,
  GRPC_INVALID_ARGUMENT,
  GRPC_MESSAGE,
  GRPC_MORE,
  GRPC_OK,
  GrpcLimits,
  GrpcServer,
} from "nish/net/grpc";
import { HttpServer, HttpServerLimits, HttpServerRequest } from "nish/net/http-server";
import { Http2Config } from "nish/net/http2";
import { PROTO_OK, ProtoReader, ProtoWriter } from "nish/net/protobuf";
import { Router, RouterLimits } from "nish/net/router";
import { tcpListen } from "nish:net";

const SUM_ALL: i32 = 0;
const COUNT: i32 = 1;

// The most reply bytes one call may have queued before it waits.
const BUDGET: i32 = 65536;

class Calls {
  sums: HttpServerRequest[] = [];
  totals: i32[] = [];
  counts: HttpServerRequest[] = [];
  next: i32[] = [];
  last: i32[] = [];
  out: ProtoWriter;

  constructor() {
    this.out = new ProtoWriter([]);
  }

  // Drops `sums[k]`, its call over, by moving the last one into its place.
  dropSum(k: i32): void {
    const last = this.sums.length - 1;
    this.sums[k] = this.sums[last];
    this.totals[k] = this.totals[last];
    this.sums.pop();
    this.totals.pop();
  }

  // Drops `counts[k]`, its call over, the same way.
  dropCount(k: i32): void {
    const end = this.counts.length - 1;
    this.counts[k] = this.counts[end];
    this.next[k] = this.next[end];
    this.last[k] = this.last[end];
    this.counts.pop();
    this.next.pop();
    this.last.pop();
  }
}

// Reads the messages `sums[k]` has in; true when its call is over.
const pump = (grpc: GrpcServer, calls: Calls, k: i32): boolean => {
  const r = calls.sums[k];
  while (true) {
    const got = grpc.next(r);
    if (got === GRPC_MORE) {
      return false;
    }
    if (got === GRPC_END) {
      calls.out.reset();
      calls.out.int32(1, calls.totals[k]);
      grpc.reply(r, calls.out.buf, 0, calls.out.end);
      return true;
    }
    if (got !== GRPC_MESSAGE) {
      return true; // `next` has answered it
    }
    const msg = new ProtoReader(grpc.messageBytes(r), grpc.messageStart(r), grpc.messageEnd(r));
    while (msg.next()) {
      if (msg.field === 1 || msg.field === 2) {
        calls.totals[k] = calls.totals[k] + msg.int32();
      }
    }
    if (msg.failed !== PROTO_OK) {
      grpc.fail(r, GRPC_INVALID_ARGUMENT, "not a SumRequest");
      return true;
    }
  }
};

// Sends `counts[k]` more replies while its queue is under `BUDGET`; true when its call is over.
const feed = (grpc: GrpcServer, server: HttpServer, calls: Calls, k: i32): boolean => {
  const r = calls.counts[k];
  // A client that stopped reading keeps the queue above `BUDGET`, so `send`
  // would never be called to see it hang up or its deadline pass.
  if (server.hungUp(r) || grpc.expired(r)) {
    grpc.finish(r, GRPC_OK, "");
    return true;
  }
  while (calls.next[k] < calls.last[k] && server.pending(r) <= BUDGET) {
    calls.out.reset();
    calls.out.int32(1, calls.next[k]);
    if (grpc.send(r, calls.out.buf, 0, calls.out.end) === GRPC_ENDED) {
      return true;
    }
    calls.next[k] = calls.next[k] + 1;
  }
  if (calls.next[k] < calls.last[k]) {
    return false;
  }
  grpc.finish(r, GRPC_OK, "");
  return true;
};

const startCount = (grpc: GrpcServer, calls: Calls, r: HttpServerRequest): void => {
  const msg = new ProtoReader(r.body, grpc.messageStart(r), grpc.messageEnd(r));
  let count: i32 = 0;
  let start: i32 = 0;
  while (msg.next()) {
    if (msg.field === 1) {
      count = msg.int32();
    } else if (msg.field === 2) {
      start = msg.int32();
    }
  }
  if (msg.failed !== PROTO_OK || count < 0 || count > 1000000 || start > 1000000) {
    grpc.fail(r, GRPC_INVALID_ARGUMENT, "not a CountRequest");
    return;
  }
  calls.counts.push(r);
  calls.next.push(start);
  calls.last.push(start + count);
};

export const main = (): i32 => {
  const router = new Router(new RouterLimits());
  router.add("POST", "/calc.Calculator/SumAll");
  router.add("POST", "/calc.Calculator/Count");
  const listener: i32 = tcpListen("127.0.0.1", 50051, 1024);
  if (listener < 0) {
    console.error(`cannot listen: ${listener}`);
    return 1;
  }
  const server = new HttpServer(new HttpServerLimits(), router);
  server.listenH2c(listener, new Http2Config(), 256);
  server.streamBody(SUM_ALL);
  const grpc = new GrpcServer(server, new GrpcLimits());
  const calls = new Calls();
  while (true) {
    server.wait(10);
    while (server.ready()) {
      const r = server.take();
      if (r.route === SUM_ALL) {
        let k: i32 = calls.sums.indexOf(r);
        if (k < 0) {
          if (grpc.open(r) !== GRPC_CALL) {
            continue; // `open` has answered it
          }
          calls.sums.push(r);
          calls.totals.push(0);
          k = calls.sums.length - 1;
        }
        if (pump(grpc, calls, k)) {
          calls.dropSum(k);
        }
      } else if (grpc.call(r) !== GRPC_CALL) {
        continue;
      } else if (r.route === COUNT) {
        startCount(grpc, calls, r);
      } else {
        server.refuse(r);
      }
    }
    // Every turn, each server-streaming call sends what its budget allows.
    for (let k: i32 = calls.counts.length - 1; k >= 0; k--) {
      if (feed(grpc, server, calls, k)) {
        calls.dropCount(k);
      }
    }
  }
};
```

The loop waits 10 ms at most, not 1000, because nothing wakes it when a
queue drains: a short wait is what sends the next replies of a `Count` that
stopped at its budget.

A client that hangs up mid-call is answered for you: `next`, `send` and
`finish` give `r` back to the server. Deadlines work as for a unary call,
counted from `open` or `call`, and are checked each time you call one of
them. A client-streaming call whose client sends nothing more is not timed
out while it waits, so a program holding several asks `grpc.expired(r)` of
each on every turn and answers the stale ones with
`grpc.finish(r, GRPC_DEADLINE_EXCEEDED, "")`.
