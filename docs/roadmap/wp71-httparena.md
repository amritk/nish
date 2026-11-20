# WP71: An HttpArena entry, and what it asks of `std/net`

**State:** Proposed · **Done:** 0 of 7 · **Design note:** [`docs/wp71-httparena.md`](https://github.com/amritk/nish/blob/main/docs/wp71-httparena.md)

## Stages

- [ ] S1: the rig: HttpArena's harness and load generators on a machine with at least 64 hardware threads, split as HttpArena splits them, with each family's leading entries measured on it
- [ ] S2: the entry, `bench/httparena/`, on what is built: the 10 scored profiles that wait on no other package, passing HttpArena's `validate.sh`
- [ ] S3: measured at 32 workers, pinned and steered, each profile's figure against its leader's in BENCHMARKS.md
- [ ] S4: the profiles that wait on other packages, each as it lands: TLS and WebSocket after [WP39](wp39-http-server.md) G7, gRPC after [WP72](wp72-grpc.md), static files after [WP43](wp43-http-app-layer.md) stage 3, `br` after [WP73](wp73-brotli.md)
- [ ] S5: io_uring under the `nish/net/http-server` façade, checked and measured on the CPU-scored profiles
- [ ] S6: enter the entry in HttpArena *(open question)*
- [ ] The gateway board: `gateway-h2`, `gateway-h3` and `production-stack`, which needs a Redis client *(deferred)*

## Next

S1, the rig: nothing about 32 cores is known until it exists. Spec: [§4](https://github.com/amritk/nish/blob/main/docs/wp71-httparena.md#4-stages), and [§3](https://github.com/amritk/nish/blob/main/docs/wp71-httparena.md#3-the-profiles-against-what-is-built) for the profiles S2 joins.

## Open questions

Whether and when to enter: a public number, the owner's call each time (D3). [§5](https://github.com/amritk/nish/blob/main/docs/wp71-httparena.md#5-decisions).

## Not planned

`fortunes`, which standard mode wants rendered by a template engine `std/` does not have (D4).

[All work packages](index.md)
