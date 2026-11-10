# WP43: The HTTP application layer

**State:** In progress · **Done:** 3 of 7 · **Design note:** [`docs/wp43-http-app-layer.md`](https://github.com/amritk/nish/blob/main/docs/wp43-http-app-layer.md)

## Stages

- [x] Stage 1: the router, `nish/net/router`
- [x] Stage 2: the handler over HTTP/1.1, `nish/net/handler`, and `examples/http-app`
- [ ] Stage 2: the handler over HTTP/2 and HTTP/3, after WP39 G7
- [ ] Stage 3: static files, `nish/net/static`: MIME types, `ETag`, `Range`, traversal refused
- [x] Stage 4: opt-in `gzip` responses, `nish/net/http-compress`
- [ ] Stage 4: `deflate` as a response coding
- [ ] Stage 4: a request body decoded under a decompression-bomb limit

## Next

Stage 3, static files. Large files want WP44's streaming reads. Spec: [§4](https://github.com/amritk/nish/blob/main/docs/wp43-http-app-layer.md#4-later-stages-of-485).

[All work packages](index.md)
