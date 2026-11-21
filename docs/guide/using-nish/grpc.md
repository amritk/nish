# gRPC

`nish/net/grpc` answers unary gRPC calls, one request message and one reply,
on the HTTP/2 listeners of [`nish/net/http-server`](http-server.md): HTTP/2
over TLS (`listenHttp2Tls`) and cleartext HTTP/2 (`listenH2c`). A call is a
route like any other: each method is a `POST` to `/<package>.<Service>/<Method>`
that you add to the server's [router](http-router.md). The messages are
protobuf, which you read and write with
[`nish/net/protobuf`](standard-library.md#nishnetprotobuf). It is imported like
any other library module
([`export` and `import`](https://github.com/amritk/nish/blob/main/docs/LANGUAGE.md#export-and-import)).

There is no code generation and no `.proto` compiler. What a field number
means is your code's, as it is with `nish/net/protobuf`.

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
calc.Calculator/GetSum` answers `{"result": 5}`. Serve real traffic over TLS
with `listenHttp2Tls`, as [One server for HTTP/1.1, 2 and 3](http-server.md#adding-http2-and-http3)
shows; nothing else in the program changes.

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

Streaming calls and compressed messages are not supported: a compressed
message is answered `UNIMPLEMENTED`.
