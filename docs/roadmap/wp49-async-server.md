# WP49: `async`/`await` on the server, and the TechEmpower top

**State:** In progress · **Done:** 4 of 5 · **Design note:** [`docs/wp49-async-server.md`](https://github.com/amritk/nish/blob/main/docs/wp49-async-server.md)

## Stages

- [x] Stages 1 to 3: the renames, `nish/net/upstream`, the Postgres pool and carrier, every TechEmpower test type
- [x] Stage 4: `async`, `await`, `Promise<T>`, `spawn`, `awaitAll`, the frame lowering
- [x] Stage 5: the executor, async `fetch` over TLS, `serve`, the async Postgres pool, cancellation, tasks reaching their spawner's objects ([#1343](https://github.com/amritk/nish/pull/1343))
- [x] Stage 6: the async TechEmpower entries, measured ([#1367](https://github.com/amritk/nish/pull/1367))
- [ ] Stage 6: the gate, the async entries within the explicit ones' noise band on `plaintext`, `json` and `db`

## Next

Meet stage 6's gate. [The latest measurement](https://github.com/amritk/nish/blob/main/docs/BENCHMARKS.md#techempower-the-gate-after-the-resume-build-wp49-stage-6) (2026-11-14, after the resume build #1621) has 4 of the 11 judged cells inside: `plaintext` 256/1024/4096 and `json` 16/256 are outside, and `json` 32 and 512 cannot be judged in that container. #1621 cut the async entry's peak RSS at `plaintext` 16,384 connections from 32.4 to 26.9 MiB. The async entry still runs about 2,054 more instructions a request than the explicit one on `plaintext` and 2,425 on `json`: the second task per request (about 425), the router (about 455 and 348) and `serveTask`'s request copy (about 378).

## Not planned

Submitting to TechEmpower (D6): TechEmpower archived the project on 2026-03-24 and takes no entries; a public number goes through [WP71](wp71-httparena.md)'s HttpArena entry. Promises as values, `for await`. `async` on the wasm profile is [WP54](wp54-async-wasm.md)'s, proposed.

[All work packages](index.md)
