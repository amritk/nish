# WP63: io_uring direct descriptors for `nish:net`

**State:** In progress · **Done:** 2 of 6 · **Design note:** [`docs/wp63-iouring-net.md`](https://github.com/amritk/nish/blob/main/docs/wp63-iouring-net.md)

## Stages

- [x] Measured and designed: a C prototype (`bench/fd-limit/`) held 300,000 sockets in one process under a hard `RLIMIT_NOFILE` of 20,000, at 39.0% less CPU per request than the epoll processes (noise band 2.8%), so the verdict is go; the note proposes slot handles behind a `tcpListenFlags` bit, `pollWait` over both kinds, the epoll fallback, and restricted rings under `--sandbox`
- [x] S1: the ring layer in `runtime/runtime-uring.c`, with no surface, and its security record ([`net-uring.md`](https://github.com/amritk/nish/blob/main/docs/security/net-uring.md)): 3,000 connections under a descriptor limit of 1,024, in three rings
- [ ] S2: slot handles in `nish:net`: `NET_LISTEN_RING`, `netRingState`, `pollWait` over rings, the guide's networking page
- [ ] S3: the sandbox rule: restricted rings made before the filter, and `sandbox.md`
- [ ] S4: `nish/net/handler` past the limit and the entry re-measured with SQLite on top, gated on the same rule
- [ ] S5: the cheaper wins for the multi-process entry, `PRAGMA mmap_size` and shared state in `nish/sync/shm`, measured on their own

## Next

S2: [§10](https://github.com/amritk/nish/blob/main/docs/wp63-iouring-net.md#10-stages); it bounds the sends queued to a peer that never reads (NURING-2). S5 does not depend on S1 to S4 and can land first.

## Open questions

Opt-in or the default for Linux listeners (D1); how many rings under `--sandbox`, and how the runtime knows before `main` (D2); one thread or a ring per thread (D3). [§11](https://github.com/amritk/nish/blob/main/docs/wp63-iouring-net.md#11-open-questions).

## Not planned

io_uring for connects, files or timers; SQPOLL; zero-copy send; rings on macOS or wasi.

[All work packages](index.md)
