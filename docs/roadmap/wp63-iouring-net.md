# WP63: io_uring direct descriptors for `nish:net`

**State:** Landed · **Open work:** [#1891](https://github.com/amritk/nish/issues/1891) · **Design note:** [`docs/wp63-iouring-net.md`](https://github.com/amritk/nish/blob/main/docs/wp63-iouring-net.md)

## Stages

- [x] Measured and designed: a C prototype (`bench/fd-limit/`) held 300,000 sockets in one process under a hard `RLIMIT_NOFILE` of 20,000, at 39.0% less CPU per request than the epoll processes (noise band 2.8%), so the verdict is go; the note proposes slot handles behind a `tcpListenFlags` bit, `pollWait` over both kinds, the epoll fallback, and restricted rings under `--sandbox`
- [x] S1: the ring layer in `runtime/runtime-uring.c`, with no surface, and its security record ([`net-uring.md`](https://github.com/amritk/nish/blob/main/docs/security/net-uring.md)): 3,000 connections under a descriptor limit of 1,024, in three rings
- [x] S2: slot handles in `nish:net`: `NET_LISTEN_RING`, `netRingState`, `pollWait` over rings, the guide's networking page; one listener serves 3,000 loopback connections under a descriptor limit of 1,024 with fewer than 64 entries in `/proc/self/fd`, and the send area and receive hold bound what a peer that does not read can make it queue (NURING-2, NURING-9)
- [x] S3: the sandbox rule: restricted rings made before the filter, and `sandbox.md`
- [x] S4: `nish/net/handler` past the limit (`HandlerLimits.ring`, -23 rests the listener like -24) and the entry re-measured with SQLite on top: one ring process spent 29.5% less CPU a request than five epoll processes at 96,000 connections under a limit of 20,000 (25.9% at 18,000; bands under 1%), at about four times the memory a connection, so the verdict is go ([BENCHMARKS.md](https://github.com/amritk/nish/blob/main/docs/BENCHMARKS.md#io_uring-under-the-handler-wp63-s4))
- [x] S5: the cheaper wins for the multi-process entry, `PRAGMA mmap_size` and shared state in `nish/sync/shm`, measured on their own against the unchanged five epoll processes at 18,000 connections (`bench/handler-ring/wins.sh`, 7 rounds): `mmap_size` spent 15.7% less CPU a request, all of it system time, with no fall in memory (RSS and PSS rise as the mapped file is counted against the workers); a shared like-count cache spent 14.9% less, mostly the cache's, since the same cache held privately was not separable from noise; both gains against a 0.6% band ([BENCHMARKS.md](https://github.com/amritk/nish/blob/main/docs/BENCHMARKS.md#the-cheaper-wins-for-five-processes-wp63-s5))

## Open work

Open stages are the sub-issues of [#1891](https://github.com/amritk/nish/issues/1891), one pull request each, specified in [`.claude/plans/wp63-iouring-net.plan.md`](https://github.com/amritk/nish/blob/main/.claude/plans/wp63-iouring-net.plan.md). What waits on a decision is labelled `needs-decision` there.

## Not planned

io_uring for connects, files or timers; SQPOLL; zero-copy send; rings on macOS or wasi.

[All work packages](index.md)
