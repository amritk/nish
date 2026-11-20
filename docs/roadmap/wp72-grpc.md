# WP72: gRPC over the HTTP/2 server

**State:** Proposed · **Done:** 0 of 6 · **Design note:** [`docs/wp72-grpc.md`](https://github.com/amritk/nish/blob/main/docs/wp72-grpc.md)

## Stages

- [ ] S1: `nish/net/protobuf`, protobuf's wire format: a reader that skips unknown fields and refuses what overruns, and a writer, with its security record
- [ ] S2: trailers on the `nish/net/http-server` façade's HTTP/2 answers
- [ ] S3: `nish/net/grpc`, unary calls on the façade's HTTP/2 listeners: the message prefix, `grpc-status` trailers, `grpc-timeout`, with its record and guide page
- [ ] S4: a stock gRPC client against both listeners in the interop job
- [ ] S5: message classes generated from a `.proto` file *(deferred)*
- [ ] S6: streaming calls *(deferred)*

## Next

S1, the wire format. Spec: [§2](https://github.com/amritk/nish/blob/main/docs/wp72-grpc.md#2-the-wire-format-nishnetprotobuf-s1). S1 and S2 do not depend on each other.

## Not planned

gRPC-Web, server reflection, message compression, health checking as a built-in service, and a gRPC client (D3).

[All work packages](index.md)
