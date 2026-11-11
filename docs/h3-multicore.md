# WP39 G6: QUIC on more than one core

**Status: design note.** Nothing here is built yet. The follow-on stage,
`g6-steer`, builds §8 and writes the security record of §6. Anchors are at
`52cc8d66`. Where an anchor names a function rather than a line, the function
is the anchor. Figures marked **measured** were taken in a 4-vCPU cloud VM
(Intel Xeon @ 2.10 GHz, Firecracker, Linux 6.18) with throwaway C programs that
are not in the repository. Figures marked **estimate** were not measured.

**The decision:** steer with a **classic BPF** reuseport program
(`SO_ATTACH_REUSEPORT_CBPF`), not eBPF and not forwarding. The program reads
one byte of the Destination Connection ID, and the server puts its worker
index in that byte. The supervisor binds and holds the UDP sockets, so a
worker's index in the group never moves. §3 gives the reasons. In short:
classic BPF needs no capability and Nish already attaches it for TCP, while
eBPF needs `CAP_BPF` and was refused in the container these figures come from.
Forwarding costs about twice a datagram's receive CPU on each packet it moves.

## 1. The problem

WP42's prefork (`std/net/prefork.ts`) runs N worker processes on one port.
With `listenPort`, the supervisor binds one `SO_REUSEPORT` socket per worker in
index order, keeps it for the whole run, and hands socket k to every start of
worker k (`prefork.ts:56-80`, `listen` at `:764`). Those sockets are TCP
listeners. A QUIC server in a worker binds its own UDP socket with `udpBind`
flag 1 (`runtime/runtime-net.c:236`), so the group is formed by whichever
workers have bound so far.

For UDP, Linux picks a socket in a reuseport group by hashing the datagram's
4-tuple. A QUIC connection is not a 4-tuple. When a client's NAT rebinds, or
the client migrates, the same connection arrives from a new address and the
hash sends it to another worker. That worker has no slot for the Destination
Connection ID, so `Http3Server` hands the datagram to the listener
(`std/net/http3-server.ts:48-56`). The listener answers with a stateless reset
for a short header packet (`QuicListener.statelessReset`,
`std/net/quic-listener.ts:906`). The reset key is the same in every worker
(`QuicServerConfig.statelessResetKey`), so that reset is valid. It ends a live
connection on another worker. This is exactly the case RFC 9000 §21.11 warns
about, and `quic-listener.ts:33-36` says the listener must never see such a
packet.

QUIC-11 (`docs/security/quic.md:103`) built path validation and migration, but
it only works when the moved packet reaches the process that holds the
connection. So G6 has two parts. The connection ID must say which process
holds the connection, and something must route each packet to that process.

## 2. The connection ID

### 2.1 Layout

Server connection IDs are 8 bytes (`QUIC_CONN_CID_LENGTH`,
`std/net/quic.ts:361`). The first ID is taken from the connection's entropy in
`begin`. The rest come from `deriveConnectionId(sequence)`
(`quic.ts:3323`): HMAC-SHA256 under the per-connection `cidSeed`, truncated to
8 bytes. G6 changes one byte:

```
byte  0       1 .. 7
     +-------+-------------------------------------------+
     |   k   |  as today: entropy (first ID) or HMAC     |
     +-------+-------------------------------------------+
k = worker index, 0 <= k < N; the rest is unchanged
```

- **Every ID the server issues carries k:** the first SCID, each
  NEW_CONNECTION_ID, and the SCID of a Retry (§4.2). The challenge and skip
  draws that also call `deriveConnectionId` (`quic.ts:3736`, `:3930`) are not
  connection IDs and are left as they are.
- **N is at most 255.** In practice prefork caps it lower: 64 workers, or 63
  with `listenPort` (`prefork.ts:917`). k is a plain byte, not a field of
  log2 N bits. The steering program takes byte 0 modulo N (§3.1), so a
  server ID, below N, names its worker exactly.
- **Uniqueness and the reset token are unchanged.** The 7 remaining bytes are
  random or HMAC output, so IDs within one worker collide as rarely as 56-bit
  random values do. IDs in different workers cannot collide because byte 0
  differs. The reset token is still `quicConnResetTokenInto(statelessResetKey,
  cid)` over all 8 bytes.
- **A server with no worker index** (one process, or Darwin; see §5) issues
  IDs exactly as today. The byte is written only when the configuration gives
  a worker index.

### 2.2 What it leaks

Byte 0 is in clear, and it is the same in every ID of a connection. An
observer learns three things from it:

1. **Linkability across migration, reduced by a factor of N.** RFC 9000 §9.5
   asks that a connection's IDs not be linkable, so that an on-path observer
   cannot follow a client from one address to the next. With k in clear, the
   new path's ID tells the observer the connection is one of those on worker
   k. The candidate set shrinks from every connection to the server to about
   1/N of them. The other 56 bits stay unlinkable. This is the trade-off of
   the plaintext mode in the QUIC-LB draft (draft-ietf-quic-load-balancers).
   That draft's encrypted modes need AES, which a classic BPF program cannot
   run (eBPF could not either, short of a hand-written cipher; §3.2).
2. **The worker count, roughly.** The largest k an observer sees is a lower
   bound on N.
3. **Which connections share a worker.** An attacker can aim load at one
   worker by choosing its own Initial's first DCID byte (§4.1). It could
   already do that with source ports through the 4-tuple hash, so this adds
   nothing it lacked. It is recorded, not mitigated.

The byte reveals no key, no counter and no sequence number. It says nothing
about the client.

## 3. The choice

### 3.1 The program

Classic BPF in a reuseport group sees the datagram from the start of the UDP
payload (**measured**: offset 0 is QUIC byte 0). A long-header packet carries
the DCID length at byte 5 and the DCID from byte 6. A short-header packet
carries the DCID from byte 1. The program is seven instructions, with N
written in when the supervisor attaches it:

```
    ldb [0]          ; first byte
    jset #0x80, long ; header form bit
    ldb [1]          ; short header: DCID byte 0
    ja done
long:
    ldb [6]          ; long header: DCID byte 0
done:
    mod #N           ; any byte names a worker
    ret a
```

The kernel uses the return value as an index into the group. **Measured** with
a 4-socket group and the program without its `mod`: 64 of 64 in-range
datagrams went to the named socket. A value of N or more was not dropped: the
kernel fell back to its 4-tuple hash for all 32 such datagrams. The `mod`
keeps every value below N, so the hash is never used and a packet's worker
depends on its DCID alone, never on the client's address. That matters for a
client that rebinds before it has the server's ID (§4.1). The `mod`'s cost
was not measured; it is one ALU instruction (**estimate**: below the noise
band, like the rest of the program). A load past the end of a short datagram
makes classic BPF return 0, so a runt goes to index 0 (§6). The program
belongs to the group, not the socket: one attach on any member steers them
all.

The same mechanism already exists for TCP. `tcpListenFlags` flag 4 attaches a
two-instruction program, `ld [SKF_AD_OFF+SKF_AD_CPU]; ret a`, through
`SO_ATTACH_REUSEPORT_CBPF` (`runtime-net.c:250-270`, the define at `:87-88`;
RT-17 and the flag-4 rows in `docs/security/runtime.md:190-193`).

**The index must not move.** When a socket in the group closes, Linux moves
the last socket into the hole. **Measured:** with 4 sockets, closing index 1
moved socket 3 to index 1. A datagram for k = 1 then reached the old worker 3,
which reset it. While another descriptor still held the socket, the index
stayed at 1. So the supervisor must bind the N UDP sockets itself, in index
order, and hold them for the whole run, as `listen` already does for TCP. A
worker that exits closes only its own copy.

### 3.2 The three candidates

| | cBPF steering (chosen) | eBPF steering | Forwarding over a UNIX socket |
| --- | --- | --- | --- |
| Mechanism | the §3.1 program on a supervisor-held group | `SK_REUSEPORT` program, `bpf_sk_select_reuseport` over a `REUSEPORT_SOCKARRAY` map keyed by k | hash steering as today; a worker that receives another worker's CID sends the datagram, its source address and its meta to worker k over a channel |
| Per-packet cost | inside the noise (**measured**, below) | of the same order as cBPF (**estimate**: one map lookup more) | about 2 µs CPU for each forwarded datagram, sender and receiver together (**measured**), on top of the ~1.1 µs receive it repeats |
| Which packets pay | none | none | every packet of a connection whose 4-tuple changed, for the rest of its life, plus Initials the hash put on another worker if the client's DCID byte disagreed |
| Kernel | Linux 4.5 and later (`SO_ATTACH_REUSEPORT_CBPF`) | Linux 4.19 and later for `SK_REUSEPORT`; 5.8 and later for `CAP_BPF` | any |
| Capability | none: a `setsockopt` on a socket the process owns | `CAP_BPF` (or `CAP_SYS_ADMIN`) to load an `SK_REUSEPORT` program whatever `kernel.unprivileged_bpf_disabled` says; the sysctl only governs socket filters. Docker's default profile grants neither capability, and its seccomp filter refuses `bpf()` without them. **Measured** here (`unprivileged_bpf_disabled=2`): both `SK_REUSEPORT` and `SOCKET_FILTER` loads gave EPERM without capabilities and succeeded as root | none |
| Code | about 15 lines of C beside TCP flag 4 | a program and a map built by hand as bytecode, or a dependency on libbpf; the verifier's errors to report; the map kept up to date by the supervisor | a header parse in the worker, a channel per pair or one through the supervisor, the address and meta (GRO segment size, ECN; `nish_udp_recv_from`) carried across |
| macOS | none: Darwin does not spread a reuseport group at all (§5) | none | possible, but Darwin hands every datagram to one socket, so every packet would be forwarded |
| Failure modes | attach refused (seccomp, gVisor, a kernel without it): the supervisor knows at bind time and falls back (§5). Index moves if the supervisor stops holding a socket (§3.1) | load refused for lack of a capability, which is the common case in containers. A map out of date sends a packet to the wrong worker, or with no socket at k, drops it | the target dead or its channel full: the packet is dropped. Service channels make prefork restart the whole group together (`prefork.ts:38-50`), so one worker's crash costs every connection |

**Measured**: the cost of a hop and of the program. A sender pinned to CPU 0
and a receiver pinned to CPU 1, 400,000 messages of 1,220 bytes per run, seven
interleaved rounds. Ranges are the lowest and highest of the seven:

| Path | Send, CPU ns/msg | Receive, CPU ns/msg | Wall ns/msg |
| --- | --- | --- | --- |
| UNIX `SOCK_SEQPACKET` pair | 883–1064 | 917–1058 | 948–1083 |
| UNIX `SOCK_DGRAM` pair | 895–1084 | 908–1061 | 927–1171 |
| UDP loopback, a 1-socket group | 2685–2994 | 1107–1193 | 2693–3547 |
| UDP loopback, a 4-socket group with the §3.1 program | 2627–2932 | 1094–1194 | 2636–2972 |

UDP send includes the loopback receive softirq, so the send column is not what
a datagram from the network costs. The two UDP rows overlap in every column,
so the program's cost cannot be told from noise. A UNIX hop costs about
0.9–1.1 µs CPU on each side, about 2 µs per forwarded datagram, or roughly
twice the 1.1 µs it took to receive the datagram from UDP in the first place.

**Estimate:** a QUIC server's own work on a 1,200-byte packet (header
protection, an AEAD open, ACK and stream bookkeeping) is a few microseconds.
Forwarding would then add something like a third to a whole of that work for
every packet it moves. It is "only the rebound connections", but a mobile
client behind a carrier NAT may rebind more than once, and every packet after
the first rebind pays.

### 3.3 Why classic BPF

- **It needs nothing the process does not have.** Default container runtimes
  allow it, and an unprivileged service allows it. eBPF would turn "run the
  server on more cores" into "grant the server `CAP_BPF`", and capability is
  what most deployments of an HTTP server refuse first. eBPF's real
  advantages are a map that can follow sockets as they move, and
  multi-byte or keyed routing. Holding the sockets in the supervisor removes
  the need for the first. §2.2 already accepts the plaintext byte, so the
  second is not needed either.
- **It costs nothing per packet,** while forwarding costs about twice the
  receive on every moved packet.
- **It fails at bind time,** in the supervisor, before a worker starts, where
  prefork already reports a failed bind. Forwarding fails per packet, at
  run time.
- **Its shape is already in the runtime** and in `docs/security/runtime.md`.

Forwarding is not built. It stays the answer for a platform that has
`SO_REUSEPORT` but cannot attach the program (§5). If a deployment needs it,
it can be added later without changing the CID layout: the worker byte is what
a forwarder would read too.

## 4. The packets that are not a plain short header

### 4.1 Initial and 0-RTT

A client's first Initial carries a DCID it chose at random, at least 8 bytes
(RFC 9000 §7.2). The program reads its first byte. If the byte is below N, it
names that worker. If not, the byte modulo N does. Either way the choice is
stable: a client keeps that DCID for every retransmitted Initial and for its
0-RTT packets until it sees the server's SCID. Whichever
worker receives the first Initial becomes the owner. Its reply's SCID carries
its own k, and every later packet from the client is steered to it by byte 0.

A client whose NAT rebinds while its DCID is still the random one, before it
has read the server's SCID, still reaches the same worker, because the
address plays no part. Had out-of-range bytes fallen back to the hash, such a
client could land on another worker. That worker would take its retransmitted
full-sized Initial as a new connection (`QuicListener.handleWindow`,
`quic-listener.ts:563-565`) and hold a slot for a handshake the client then
discards (RFC 9000 §7.2). A client that coalesces packets in one datagram is
steered by the first packet's header, as `Http3Server` routes them today.

### 4.2 Retry

A Retry is stateless and its token is valid on any worker: the
`retryTokenKey` is shared, and the token binds the original DCID, the Retry
SCID, the time and the client's address (`QuicListener`). The worker that
sends the Retry puts its own k in the Retry SCID. The client's next Initial
uses that SCID as its DCID, so the retried Initial goes back to the worker
that sent the Retry. The answer would also be correct on any other worker. A
fixed destination keeps the test deterministic.

### 4.3 Version Negotiation

Stateless, on whichever worker the DCID's first byte picks. Nothing
changes.

### 4.4 A worker that dies

The supervisor holds socket k, so k's index stays in place and datagrams for
k's connections queue in that socket's receive buffer, up to its size, then
the kernel drops them. The restarted worker k inherits the same socket, finds
no slot for those IDs, and answers short-header packets with a stateless
reset. The reset key is static and shared, so each reset is valid and the
client closes at once instead of waiting out its idle timeout. Connections on
the dead worker are lost; moving QUIC connection state between processes is
out of scope (§9). Connections on the other workers are untouched, because no
other worker sees a packet whose byte 0 is k.

If `serviceWorker` channels are configured, prefork restarts the whole group
(`prefork.ts:38-50`), and every connection is lost the same way. Steering
needs no channels, so a QUIC server should not configure them for steering.

### 4.5 A rebinding peer

This is the case G6 exists for. The client's next short-header packet arrives
from a new 4-tuple with a DCID whose byte 0 is k. The program sends it to
worker k. Worker k's connection sees a known DCID from a new address and runs
QUIC-11's migration and path validation unchanged. A client that migrates to a
new connection ID (one from NEW_CONNECTION_ID) is steered the same way, since
those IDs carry k too.

## 5. Platforms

**Linux** steers as above. If the attach fails, `udpBind` returns the error
and the supervisor runs one worker for QUIC, saying so on stderr, the way an
unusable `pin` is reported (`prefork.ts:70`). It never falls back to hash
spreading, because hash spreading is the bug in §1. Sandboxes that may refuse
the attach: seccomp profiles stricter than Docker's default, and gVisor. That
gVisor does not implement it is an **estimate**, not checked.

**Darwin** binds `SO_REUSEPORT` but sends each datagram to one socket of the
group (WP42 §3), so there is nothing to steer. The steering flag answers -95
there, and prefork's default of one worker on Darwin stays. A QUIC server on
Darwin is one process.

**wasm32 and WASI** have no sockets. NL2404 refuses the flag at compile time,
like every `nish:net` call.

**Containers:** classic BPF is a `setsockopt` on a socket the process owns,
so the default Docker, containerd and Kubernetes profiles allow it.
**Measured** here: the attach succeeds unprivileged in a container with
`unprivileged_bpf_disabled=2`, where eBPF loads get EPERM.

**GRO:** with `udpBind` flag 2 (`UDP_GRO`), the kernel coalesces datagrams of
one flow before they are queued. The design assumes that the reuseport
selection runs on the coalesced packet's first segment, and that one flow
(one 4-tuple) is one connection, so coalescing never mixes two workers'
datagrams. This is an **assumption**. The test matrix checks it (§7, row 9).

## 6. Security surface

`g6-steer` writes the record `docs/security/quic-multicore.md`, adds its index
row in `docs/security/README.md`, and names `std/net/prefork.ts`'s UDP path
and the runtime flag in its scope. RT-17 in `runtime.md` is amended for the
UDP attach. The record carries:

- **No reset for another worker's ID.** A worker never sends a stateless reset
  for a short-header DCID whose byte 0 is below N and is not its own k. With
  steering working, such a packet cannot arrive. If it does (a moved index, a
  bug, a packet a sibling injected), a reset would be valid under the shared
  key and would kill the sibling's live connection (RFC 9000 §21.11). The
  listener drops it instead. A byte 0 at or above N is not one of this run's
  IDs, so the reset is safe and stays.
- **The plaintext worker byte** and the linkability it costs (§2.2), recorded
  as Decided.
- **Runts land on worker 0.** A datagram too short for the program's load
  returns 0 and goes to worker 0. The listener already drops anything too
  short to be a QUIC packet, so this only skews load. Recorded so that no one
  "fixes" it by trusting the length.
- **Who may join the group.** On Linux, any process of the same effective uid
  that sets `SO_REUSEPORT` can bind the port. It joins the group at index N,
  and it can replace the group's program with one of its own. This is RT-17's
  hazard, inherited: the program that asks for the flag accepts that any
  process of its user may share the port.
- **One reset key and one Retry key for all workers.** They come from the
  configuration, which every worker reads, and must survive a restart
  (`QuicServerConfig.statelessResetKey`: "keep across restarts") for §4.4's
  resets to be valid. Each worker wipes its copy on `stop`
  (`http3-server.ts:1251-1252`). No worker holds a key another lacks, so a
  compromised worker learns nothing new.
- **Undefined flag bits** answer -22 before a socket is made, as for the
  existing flags.

## 7. Test matrix

| # | What | Where | Platforms |
| --- | --- | --- | --- |
| 1 | The flag attaches the program. A datagram whose DCID byte 0 is k reaches socket k for short and long headers. Byte 0 ≥ N reaches socket byte mod N. A runt reaches socket 0. -22 for an undefined bit; -95 on Darwin | `tests/runtime-test.c` (`test_udp_steer`) | Linux; Darwin for -95 |
| 2 | Every ID a worker issues carries its k: first SCID, NEW_CONNECTION_ID, Retry SCID. With no worker index, IDs are as before | a unit case over `QuicConnection` and `QuicListener` | all |
| 3 | A short-header packet whose byte 0 names another worker gets no stateless reset; byte 0 ≥ N still does | a unit case over `QuicListener` | all |
| 4 | **Two workers; a client completes a request, rebinds its port mid-connection, and the next response reaches the new port from the same worker** (each response names its worker) | `tests/link/net_quic_prefork` | Linux |
| 5 | Initials whose first DCID byte is below N and above it both complete a handshake, and one whose client rebinds between two Initials still completes on one worker | `net_quic_prefork` | Linux |
| 6 | A Retry from worker 1 brings the retried Initial back to worker 1 | `net_quic_prefork` | Linux |
| 7 | Killing worker 1: its client gets a valid stateless reset from the restarted worker 1; worker 0's client finishes its request on the same connection | `net_quic_prefork` | Linux |
| 8 | Index stability: with three workers, kill worker 1; packets with byte 0 = 1 reach the new worker 1, not worker 2 | `net_quic_prefork` | Linux |
| 9 | With `UDP_GRO` on, row 4 still holds | `net_quic_prefork`, run with flag 2 | Linux |
| 10 | Darwin runs QUIC with one worker and says so | `net_quic_prefork` | Darwin |
| 11 | The flag under a wasm target is refused with NL2404 | `tests/cases/reject_net_udp_steer_wasm` | wasm32 |

Row 4 is the acceptance test of the stage. Built against today's code, it
fails: the rebound packet is hashed to the other worker and answered with a
reset.

## 8. What `g6-steer` builds

- **Runtime:** a `udpBind` flag 4 that, after the bind, attaches §3.1's
  program with `SO_ATTACH_REUSEPORT_CBPF`. It requires flag 1, answers -22
  without it, and -95 off Linux. This is a change to `runtime/runtime-net.c`
  even though classic BPF, not eBPF, was chosen. The plan listed that file as
  "only if eBPF". It is about 15 lines next to TCP flag 4. Because the flag is
  visible to users, it also needs its `docs/LANGUAGE.md` row (`:10872`), the
  `runtime/nish.d.ts` comment (`:1719`) and the guide page, which are outside
  the plan's file list.
- **Prefork:** a way to make `listenPort` bind UDP. `PreforkConfig` gets a
  `listenUdp: boolean`. With it, `listen` binds N UDP sockets with flags 1
  and 4 (and 2 from `listenFlags` for GRO), holds them, and hands socket k to
  worker k through `preforkListener`, as it does for TCP. When the attach
  fails, it falls back to one worker (§5). The names are a proposal; the
  stage chooses.
- **QUIC:** a worker index in `QuicServerConfig` (default -1: none). With it,
  `begin`, the NEW_CONNECTION_ID path through `deriveConnectionId`
  (`quic.ts:3363`) and the Retry SCID write k into byte 0. `QuicListener` applies §6's reset rule. `Http3Server` passes
  the index through and does not change its routing: the slot index already
  keys on all 8 bytes. `quic-conn-cid.ts`'s table holds the IDs and does not
  care what byte 0 is.

## 9. Not in this stage, on purpose

- **Moving a connection between workers,** for a graceful restart or a
  rebalance. The state is TLS keys, recovery and streams, and moving it is a
  different design.
- **Encrypted worker IDs** (QUIC-LB's encrypted modes). They need AES in the
  steering program, which classic BPF cannot do.
- **Forwarding,** unless a platform that needs it turns up (§3.3).
- **A benchmark of the spread.** An HTTP/3 `BENCH_CORES` path like HTTP/1's
  belongs to G8.
- **A load balancer in front of several hosts.** The byte layout leaves room
  for a server ID in front of k, but nothing reads it.
- **Threads.** WP42 §1 chose processes, and G6 keeps them.
