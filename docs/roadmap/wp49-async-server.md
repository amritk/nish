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

Meet stage 6's gate. [The latest measurement](https://github.com/amritk/nish/blob/main/docs/BENCHMARKS.md#techempower-the-gate-after-the-hand-off-build-wp49-stage-6) (2026-11-14, after the hand-off build #1601) has 4 of the 11 judged cells inside: `plaintext` 256/1024/4096 and `json` 16/128/256 are outside, and `json` 512 cannot be judged; the recorded `/queries` at 64 connections fell 9.3% against itself, beyond its band. The async entry still runs about 2,040 more instructions a request than the explicit one on `plaintext` and 2,430 on `json`, most of it in `serve`'s two resumes per request and the router.

## Open questions

D6: whether and when to submit, shared with WP39 E9.

## Not planned

Promises as values, `for await`. `async` on the wasm profile is [WP54](wp54-async-wasm.md)'s, proposed.

[All work packages](index.md)
