# WP42: A multi-core server from pre-forked processes

**State:** Landed · **Done:** 1 of 1 · **Design note:** [`docs/wp42-multicore-server.md`](https://github.com/amritk/nish/blob/main/docs/wp42-multicore-server.md)

## Stages

- [x] `SO_REUSEPORT`, `spawn`/`kill`/`waitPid`/`availableParallelism`, the `nish/net/prefork` supervisor with restarts and channels, measured at 1, 2 and 4 cores

## Next

Nothing scheduled. Any unchecked item is deferred; the note says what would reopen it.

## Not planned

A socket handed to a `scope()` task, hot reload, `SIGCHLD` in `signalFd`.

[All work packages](index.md)
