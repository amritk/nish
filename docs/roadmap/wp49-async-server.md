# WP49: `async`/`await` on the server, and the TechEmpower top

**State:** In progress · **Done:** 4 of 6 · **Design note:** [`docs/wp49-async-server.md`](https://github.com/amritk/nish/blob/main/docs/wp49-async-server.md)

## Stages

- [x] Stages 1 to 3: the renames, `nish/net/upstream`, the Postgres pool and carrier, every TechEmpower test type
- [x] Stage 4: `async`, `await`, `Promise<T>`, `spawn`, `awaitAll`, the frame lowering
- [x] Stage 5: the executor, async `fetch` over TLS, `serve`, the async Postgres pool, cancellation, tasks reaching their spawner's objects ([#1343](https://github.com/amritk/nish/pull/1343))
- [x] Stage 6: the async TechEmpower entries, measured ([#1367](https://github.com/amritk/nish/pull/1367))
- [ ] Stage 6: the gate, the async entries within the explicit ones' noise band on `plaintext`, `json` and `db`
- [ ] Submit to TechEmpower *(open question)*

## Next

Meet stage 6's gate: [the measurement](https://github.com/amritk/nish/blob/main/docs/BENCHMARKS.md#techempower-the-async-entry-against-the-explicit-one-wp49-stage-6) has the async entries outside the band.

## Open questions

D6: whether and when to submit, shared with WP39 E9.

## Not planned

Promises as values, `for await`, `async` on the wasm profile.

[All work packages](index.md)
