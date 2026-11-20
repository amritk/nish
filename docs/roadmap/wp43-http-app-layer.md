# WP43: The HTTP application layer

**State:** In progress · **Done:** 3 of 9 · **Design note:** [`docs/wp43-http-app-layer.md`](https://github.com/amritk/nish/blob/main/docs/wp43-http-app-layer.md)

## Stages

- [x] Stage 1: the router, `nish/net/router`
- [x] Stage 2: the handler over HTTP/1.1, `nish/net/handler`, and `examples/http-app`
- [ ] Stage 2: the handler over HTTP/2 and HTTP/3, after WP39 G7, whose façade landed in [#1473](https://github.com/amritk/nish/pull/1473)
- [ ] Stage 3: static files, `nish/net/static`: MIME types, `ETag`, `Range`, traversal refused, a cache that follows the disk, and a file's `.br` or `.gz` sibling sent when the request offers it, over every version the façade serves
- [x] Stage 4: opt-in `gzip` responses, `nish/net/http-compress`
- [ ] Stage 4: `deflate` as a response coding
- [ ] Stage 4: `br` as a response coding, on [WP73](wp73-brotli.md)'s encoder
- [ ] Stage 4: a request body decoded under a decompression-bomb limit
- [ ] Stage 5: middleware, steps a program runs before and after its route bodies *(open question)*

## Next

Stage 3, static files. Large files want WP44's streaming reads. Spec: [§4](https://github.com/amritk/nish/blob/main/docs/wp43-http-app-layer.md#4-later-stages-of-485), which also lists what [WP71](wp71-httparena.md)'s `static-h2` and `static-h3` profiles ask of it.

## Open questions

Whether to build middleware (stage 5): what a step may see and change, and whether it costs a route that uses none of it anything. HttpArena takes 2.5% off a framework's family score for each of routing, middleware, request and response its entry declares missing ([§4](https://github.com/amritk/nish/blob/main/docs/wp43-http-app-layer.md#4-later-stages-of-485)).

[All work packages](index.md)
