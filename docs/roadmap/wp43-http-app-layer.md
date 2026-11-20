# WP43: The HTTP application layer

**State:** In progress · **Open work:** [#1857](https://github.com/amritk/nish/issues/1857) · **Design note:** [`docs/wp43-http-app-layer.md`](https://github.com/amritk/nish/blob/main/docs/wp43-http-app-layer.md)

## Stages

- [x] Stage 1: the router, `nish/net/router`
- [x] Stage 2: the handler over HTTP/1.1, `nish/net/handler`, and `examples/http-app`
- [x] Stage 2: the handler over HTTP/2 and HTTP/3: WP39 G7's `nish/net/http-server` ([#1473](https://github.com/amritk/nish/pull/1473))
- [x] Stage 4: opt-in `gzip` responses, `nish/net/http-compress`
