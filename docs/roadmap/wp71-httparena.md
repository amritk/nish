# WP71: An HttpArena entry, and what it asks of `std/net`

**State:** Proposed · **Done:** 0 of 9 · **Design note:** [`docs/wp71-httparena.md`](https://github.com/amritk/nish/blob/main/docs/wp71-httparena.md)

## Stages

- [ ] S1: the entry, `bench/httparena/`, on what is built: the 10 scored profiles that wait on no other package, one pinned and steered worker a core, passing HttpArena's `validate.sh`
- [ ] S2a: `json-tls` and `8gbit`, HTTP/1.1 over TLS, after [WP39](wp39-http-server.md) G7's TLS on the façade *(deferred)*
- [ ] S2b: `echo-ws`, `echo-ws-pipeline` and `echo-ws-limited`, after [WP39](wp39-http-server.md) G7's WebSocket on the façade *(deferred)*
- [ ] S2c: `unary-grpc` and `unary-grpc-tls`, after [WP72](wp72-grpc.md) *(deferred)*
- [ ] S2d: `static-h2` and `static-h3`, after [WP43](wp43-http-app-layer.md) stage 3 *(deferred)*
- [ ] S2e: `br` for `json-comp`, after [WP73](wp73-brotli.md) *(deferred)*
- [ ] S3: io_uring under the `nish/net/http-server` façade, checked and measured on the CPU-scored profiles
- [ ] S4: enter the entry in HttpArena *(open question)*
- [ ] S5: the gateway board: `gateway-h2`, `gateway-h3` and `production-stack`, which needs a Redis client *(deferred)*

## Next

S1, the entry on what is built. Spec: [§4](https://github.com/amritk/nish/blob/main/docs/wp71-httparena.md#4-stages), and [§3](https://github.com/amritk/nish/blob/main/docs/wp71-httparena.md#3-the-profiles-against-what-is-built) for the profiles it joins.

## Open questions

Whether and when to enter: a public number, the owner's call each time (D3). [§5](https://github.com/amritk/nish/blob/main/docs/wp71-httparena.md#5-decisions).

## Not planned

`fortunes`, which standard mode wants rendered by a template engine `std/` does not have (D4).

[All work packages](index.md)
