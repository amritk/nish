# Security record: QUIC on every core — steering, worker-marked IDs and the UDP group

The record of WP39's stage G6, the design in
[`docs/h3-multicore.md`](../h3-multicore.md): a prefork group of N workers on
one UDP port, where the kernel hands each datagram to the worker whose index
is byte 0 of its destination connection ID. It covers the three places that
make that work: `udpBind` flag 4 in the runtime (the classic-BPF reuseport
program), the worker byte in every connection ID a `QuicListener` and a
`QuicConnection` issue, and the supervisor in `nish/net/prefork` that binds
the group and hands socket `k` to worker `k`.

It says what each refuses and with what, where a cap is set, what a peer can
choose, and the test that pins each property. It is written with the code
rather than after an audit, at `bc281ac8` on the stage's branch; function
names are given rather than line numbers. QUIC itself is
[quic.md](quic.md), the HTTP/3 carrier [http3.md](http3.md), and the
runtime's sockets [runtime.md](runtime.md) (RT-17 is amended for flag 4).

**Result.** A datagram reaches the worker its connection ID names, for a
short header and a long one, and a worker never answers a datagram a sibling
owns with a stateless reset, which would end that sibling's live connection.
A kernel that refuses the steering program leaves one worker serving the
port, never N workers that would misroute each other's packets. Two findings
are closed here (QM-1, QM-2) and two are accepted, Low (QM-3, QM-4): a peer
picks the worker its first Initial lands on, and byte 0 of every ID tells an
observer which worker issued it.

## Scope

| File | What was read |
| --- | --- |
| `std/net/prefork.ts` | the whole supervisor: `preforkBindUdp` (the group, its fallback and its failure paths), the `--nish-prefork-udp=` flag (`preforkUdpListener`, `preforkUdpCount`, `preforkUdpField`), what `preforkArgs` strips, the worker count's cap, and how a restarted worker gets the same socket |
| `std/net/quic.ts` | `QuicServerConfig.workerIndex` and `workerCount`, `quicWorkerCheck` and its panic, `quicWorkerByte`, and where the byte is written into the first SCID and every NEW_CONNECTION_ID |
| `std/net/quic-listener.ts` | the no-reset rule in `handleWindow`, and the worker byte in the Retry SCID |
| `std/net/quic-conn-cid.ts` | that an ID issued later keeps byte 0 and draws the rest as before |

Read beside them, without owning them: `nish_udp_bind` in
`runtime/runtime-net.c` (flag 4, recorded in RT-17 of
[runtime.md](runtime.md)), `std/net/http3-server.ts` (which passes the
configuration through) and `tests/runtime-test.c` (`test_udp_steer`).

## Threat model

The attacker is any host that can send UDP datagrams to the port, and an
on-path observer of them. It chooses every byte of every datagram it sends,
including the destination connection ID of a first Initial and of a short
header packet it forges; it does not hold the server's reset-token key or
any connection's keys. Whoever starts the program chooses its arguments and
environment (`NISH_WORKERS`, the `--nish-prefork-*` flags), as for the rest
of `nish/net/prefork`: they are not attacker input.

## Findings

| ID | Severity | Where | Finding | Status |
| --- | --- | --- | --- | --- |
| QM-1 | Low | `std/net/quic-listener.ts` (`handleWindow`) | **A misrouted short-header datagram drew a stateless reset from the wrong worker.** Every worker of a group shares the reset-token key, so a worker that answers a short header it holds no connection for with a reset (RFC 9000 §10.3) makes a valid reset for a sibling's live connection. Under steering that datagram does not reach it, but a peer that rebinds while a packet is in flight, or a kernel that briefly hands the port to one socket during a restart, can deliver one. **Fixed:** a worker drops a short header whose byte 0 names another worker of its group (below `workerCount`, not `workerIndex`); byte 0 at or above the count is no worker's, and is answered as before. | **Closed.** Pinned by `net_quic_worker` (worker 0 of 2 drops a short header for worker 1's ID and resets one for its own, or for byte 2 or 255; unset, a listener resets what worker 0 dropped) and `net_quic_prefork` row 12 (a restarted worker 1 resets its own dead connection's client, and worker 0's client is untouched, row 13). |
| QM-2 | Low | `std/net/prefork.ts` (`preforkBindUdp`) | **A refused steering program would have left N workers unsteered.** Without the program, `SO_REUSEPORT` spreads datagrams by the 4-tuple hash, so a connection's packets reach a worker that does not hold it, and under QM-1's rule are dropped; before it, they drew resets. **Fixed:** when the first bind with flag 4 fails, the supervisor binds one plain socket, prints `nish/net/prefork: QUIC steering refused (<errno>), running one worker` on stderr, and runs one worker; when even that fails it prints the bind error and binds nothing. A later socket of the group that fails to bind closes every socket before it (not pinned: no test makes the second bind fail). | **Closed.** Pinned by `net_quic_prefork` row 1 (one worker and the stderr line where the runtime answers -95) and `tests/runtime-test.c` (`test_udp_steer`: -95 off Linux, and every malformed flags word -22). |
| QM-3 | Low | `std/net/quic.ts`, steering | **A peer picks the worker its handshake lands on.** The first Initial's DCID is the client's choice, so a client sets byte 0 and chooses a worker (modulo N), and a flood of Initials can be aimed at one worker. A connection moves to its own worker's IDs after the handshake, so only the handshake is aimed. | **Accepted.** The same holds for any steering a client's first datagram decides, including the 4-tuple hash, which a client picks by its source port. What a handshake costs is bounded per worker as in [http3.md](http3.md) (H3-1, H3-3), and Retry (`net_quic_prefork` rows 15 and 16) stays on the worker that issued it. |
| QM-4 | Low | `std/net/quic.ts` (`quicWorkerByte`) | **Byte 0 of every ID names its worker.** An observer learns which worker issued a connection ID, so IDs a connection moves to after migration share that byte with each other and with every other connection on that worker. RFC 9000 §9.5 asks that IDs not be linkable; one byte of N values links a connection to a group of about 1/N of the server's connections, no closer. | **Accepted.** It is what makes the kernel's choice possible without state, as QUIC-LB's plaintext algorithm does; the other 7 bytes are drawn fresh for each ID as before (`net_quic_worker`, "the other bytes are the same either way": marking changes byte 0 only). |

## Properties verified

| Property | Pinned by |
| --- | --- |
| A short header's DCID byte 0 (offset 1) and a long header's (offset 6) pick socket (byte mod N) of the group in bind order; a datagram too short to hold it reaches socket 0 | `tests/runtime-test.c`, `test_udp_steer` |
| Flag 4 without flag 1, with flag 2, with N 0, N without flag 4, and any bit outside `0xff07` answer -22; off Linux, flags 2 and 4 answer -95; a refused attach closes the socket and answers the errno | `tests/runtime-test.c`, `test_udp_steer`; `tests/cases/net_udp_calls` |
| Every ID a worker issues starts with its index: the first SCID, each NEW_CONNECTION_ID and the Retry SCID; with the pair unset (-1 and 0) none is marked | `net_quic_worker`; `net_quic_prefork` rows 2, 9, 15 and 16 |
| `workerIndex` and `workerCount` are both unset or `0 <= k < n <= 255`; anything else panics with `nish/net/quic: workerIndex <k> and workerCount <n>, not 0 <= k < n <= 255` when the listener or server is made | `net_quic_worker` (the past, zero, below and wide cases) |
| `NISH_WORKERS` above 255 panics in the supervisor before any worker starts; 255 workers start, and byte 254 reaches worker 254 | `net_quic_prefork` rows 20 to 23 |
| A restarted worker gets the same socket of the group, so the kernel's choice for its byte does not move to a sibling | `net_quic_prefork` rows 11 and 18 |
| A connection survives its client's rebinding on the same worker, and the path is validated | `net_quic_prefork` rows 3 to 5 |
| A worker trusts the descriptor and count in `--nish-prefork-udp=<fd>,<N>` as given, the same boundary as `--nish-prefork-listener=`; a malformed value (a missing field, a count of 0 or above 255, a negative descriptor, a third field, a non-number) gives no socket and no group, and `preforkArgs` strips the flag | `net_quic_worker` (the flag checks) |

## Steering off

`net_quic_prefork`'s acceptance row was also run with the group bound
without flag 4 (each socket `SO_REUSEPORT` only): connections then reached
workers by the 4-tuple hash, and the rows that depend on the owning worker
(a rebinding client, Initials past the count, a ClientHello split across
ports, a restart's reset) failed in nearly every run. That is the behaviour
QM-2's fallback exists to avoid.
