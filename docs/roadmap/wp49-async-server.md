# WP49: `async`/`await` on the server, and the TechEmpower top

**State:** In progress · **Open work:** [#1854](https://github.com/amritk/nish/issues/1854) · **Design note:** [`docs/wp49-async-server.md`](https://github.com/amritk/nish/blob/main/docs/wp49-async-server.md)

## Stages

- [x] Stages 1 to 3: the renames, `nish/net/upstream`, the Postgres pool and carrier, every TechEmpower test type
- [x] Stage 4: `async`, `await`, `Promise<T>`, `spawn`, `awaitAll`, the frame lowering
- [x] Stage 5: the executor, async `fetch` over TLS, `serve`, the async Postgres pool, cancellation, tasks reaching their spawner's objects ([#1343](https://github.com/amritk/nish/pull/1343))
- [x] Stage 6: the async TechEmpower entries, measured ([#1367](https://github.com/amritk/nish/pull/1367))

## Open work

Open stages are the sub-issues of [#1854](https://github.com/amritk/nish/issues/1854), one pull request each, specified in [`.claude/plans/wp49-async-server.plan.md`](https://github.com/amritk/nish/blob/main/.claude/plans/wp49-async-server.plan.md). What waits on a decision is labelled `needs-decision` there.

## Not planned

Promises as values, `for await`. `async` on the wasm profile is [WP54](wp54-async-wasm.md)'s, proposed.

[All work packages](index.md)
