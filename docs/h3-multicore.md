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
listeners. Nothing binds a UDP reuseport group for QUIC today.
`Http3Server` binds nothing: its caller passes the socket in, and the usage
example in its doc comment binds with flags 0
(`std/net/http3-server.ts:17`). `examples/relay` binds with 2 or 0. The deployment G6 enables is N workers whose
QUIC servers share one port through `udpBind` flag 1
(`runtime/runtime-net.c:236`). Built that way on today's code, without
steering, it fails as follows.

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
- **N is at most 255.** Prefork does not cap it there today. Its only cap,
  64 workers or 63 with `listenPort`, applies only when a service worker is
  configured (`prefork.ts:954-957`). Otherwise the count has no upper bound,
  and §4.4 tells a QUIC server not to configure a service worker. So the
  `listenUdp` path checks the count itself: above 255, `preforkSupervise` panics with
  `nish/net/prefork: listenUdp with <count> workers, above 255` before it
  binds anything (§8, §7 row 12). A panic and not a fallback to one worker,
  because a count the operator set that high is a configuration error, and
  prefork already panics for its other bad counts. k is a plain byte, not a field of
  log2 N bits. The steering program takes byte 0 modulo N (§3.1), so a
  server ID, below N, names its worker exactly.
- **Who knows k and N, and how.** Only the supervisor computes N
  (`preforkWorkerCount`, after the 255 check and any fallback of §5). A
  worker cannot work it out again: under `pin`, `availableParallelism()`
  is 1 in the worker, and `NISH_WORKERS` and `PreforkConfig.workers` may
  both be unset. So the supervisor hands both values down. k travels as
  today, in the worker flag (`--nish-prefork-worker=`, read by
  `preforkIndex`). N travels beside the UDP socket's descriptor in one new
  flag, `--nish-prefork-udp=<fd>,<N>`, which `preforkUdpListener(args)` and
  `preforkUdpCount(args)` read (§8). The application copies the two values
  into `QuicServerConfig.workerIndex` and `QuicServerConfig.workerCount`, and
  the connection and the listener read them only from there. The runtime
  learns N separately, from bits 8–15 of each `udpBind` the supervisor makes.
  Nothing else re-derives either value. Both readers parse the same flag:
  `<fd>,<N>`, two runs of digits (`preforkDigits`, as `preforkListener`
  uses) with N from 1 to 255. When the flag is absent, or present but not of
  that shape (`=5,`, `=,2`, `=5,0`, `=5,256`, `=-1,2`, a third field), both
  answer as outside prefork: `preforkUdpListener` -1 and `preforkUdpCount` 0.
  The supervisor writes only well-formed flags, so a malformed one means the
  arguments were not the supervisor's. The application then has no UDP
  socket and leaves both QUIC fields unset (§8). It never sees a descriptor
  without its count (§7, row 15).
- **k is checked against N where the configuration is used.** k is written
  into a `u8`, so an index of 256 would issue byte 0, 300 would issue 44, and
  a negative index other than -1 has no meaning. The configuration is valid
  when both fields are unset (`workerIndex` -1 and `workerCount` 0), or when
  0 ≤ k < N ≤ 255. Anything else panics when a `QuicListener` or an
  `Http3Server` is built from it, before a socket is read, with
  `nish/net/quic: workerIndex <k> and workerCount <n>, not 0 <= k < n <= 255`.
  A panic, as for the count above 255, because the values come from the
  supervisor and a bad pair means the application wired them wrongly (§7,
  row 13).
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
carries the DCID from byte 1. The program is seven instructions. N is its
`mod` constant, so the runtime builds the program at attach time from the
count the supervisor passes in `udpBind`'s flags (§8):

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
| Code | about 30–40 lines of C beside TCP flag 4 (**estimate**, §8) | a program and a map built by hand as bytecode, or a dependency on libbpf; the verifier's errors to report; the map kept up to date by the supervisor | a header parse in the worker, a channel per pair or one through the supervisor, the address and meta (GRO segment size, ECN; `nish_udp_recv_from`) carried across |
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
names that worker. If not, the byte modulo N does. When N does not divide
256, that spread is uneven: the low residues get one more of the 256 byte
values than the high ones (with N = 3, worker 0 gets 86/256 of new
connections and workers 1 and 2 get 85/256). This affects load only, never
correctness. Either way the choice is
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

New connections stall too. A client picks its first DCID at random, so about
1/N of new Initials have a byte 0 that the program sends to socket k (byte 0
mod N = k). While worker k is down they wait in socket k's buffer, and the
client retransmits on its probe timer. The handshake completes once worker k
is back, if the client is still trying. A worker that exits within
`quickExitMs` of its start waits `backoffMs` (100 ms) before its restart,
doubling each time up to `backoffCapMs` (5 s, `prefork.ts:86-90`), so a
worker in a crash loop holds those handshakes for up to 5 seconds at a time,
and a client with a shorter handshake timeout gives up. Clients that retry
with a fresh random DCID usually land on a live worker. This is recorded, not
fixed. A fix would mean the supervisor attaches a new program that maps k to
a live worker while k is down, and back again after. That is a cBPF attach
the supervisor can make, but the cost is a second program to get right. This
stage leaves it out (§9).

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

**Linux** steers as above. If the attach fails, `udpBind` closes the socket
and returns the error, and the supervisor runs one worker for QUIC, saying so
on stderr, the way an unusable `pin` is reported (`prefork.ts:70`). It never
falls back to hash spreading, because hash spreading is the bug in §1. The
fallback is settled **before anything else uses the count**. The supervisor
binds the UDP group first, before it checks `serviceWorker` and `fdMax`,
before `pin`'s CPU check, and before it builds the `PreforkSupervisor` with
its slots, the TCP group and the `ready` array. All of those then see the
final count. The steps, in `preforkSupervise` right after the count and its
255 check:

1. The supervisor binds UDP socket 0 with flags 1, 4 and N. A refused
   attach shows there, on the first bind.
2. If that bind fails, the supervisor binds socket 0 again with flag 1 alone.
   If that bind also fails, the port is the problem, not the attach. The
   supervisor prints `nish/net/prefork: cannot bind UDP <host>:<port>
   (<error>)` and returns `PREFORK_SPAWN_FAILED`, as `listen` does for TCP
   today, with no fallback.
3. If the second bind succeeds, the attach was refused. The supervisor keeps
   that one socket, prints `nish/net/prefork: QUIC steering refused (<error>),
   running one worker`, and sets the count to 1.
4. Only then does it run the existing checks and build the supervisor with
   that count. It builds one slot, binds one TCP listener and sizes `ready`
   for one worker. No TCP listener is ever bound for a worker that will not
   run.
5. Worker 0 gets k = 0, its one TCP listener and `--nish-prefork-udp=<fd>,1`.

A `serviceWorker` of 1 or more then fails the existing check against the
count of 1 with that check's panic. §4.4 already tells a QUIC server not to
configure one. A failure on UDP socket i > 0, after socket 0 attached, is a
bind error, so the supervisor closes the UDP sockets it bound and returns
`PREFORK_SPAWN_FAILED`. A count of 1 never asks for
steering. With N = 1 there is one socket and nothing to choose between, so
the supervisor binds it with flag 1 alone. That covers `NISH_WORKERS=1`,
Darwin's default and the fallback the same way. The worker still gets
k = 0 and N = 1, which are valid (§2.1). Byte 0 of its IDs is 0, and the
reset rule of §6 then excludes nothing. Sandboxes that may refuse
the attach: seccomp profiles stricter than Docker's default, and gVisor. That
gVisor does not implement it is an **estimate**, not checked.

**Darwin** binds `SO_REUSEPORT` but sends each datagram to one socket of the
group (WP42 §3), so there is nothing to steer. The steering flag answers -95
there, and prefork's default of one worker on Darwin stays. A QUIC server on
Darwin is one process.

**wasm32 and WASI** have no sockets. NL2404 refuses `udpBind` itself at
compile time, whatever its flags are, as it does every `nish:net` call. A
steered bind is refused the same way, with no new check.

**Containers:** classic BPF is a `setsockopt` on a socket the process owns,
so the default Docker, containerd and Kubernetes profiles allow it.
**Measured** here: the attach succeeds unprivileged in a container with
`unprivileged_bpf_disabled=2`, where eBPF loads get EPERM.

**GRO is off on a steered socket.** With `udpBind` flag 2 (`UDP_GRO`), the
kernel coalesces datagrams of one flow (one 4-tuple) into one buffer, and the
reuseport selection runs once for it, on its first segment. That is an
**estimate** from reading the kernel's UDP GRO receive path; it was not
measured here, and the design does not depend on it, because GRO is off. A flow is not a
connection: a client can run several QUIC connections over one UDP socket,
and the server can have issued their IDs from different workers. Coalesced,
the second connection's datagrams would reach the first one's worker, which
by §6's rule drops them, and that connection would stall. So flag 4 refuses
flag 2: `udpBind` answers -22 when both are set, and prefork never asks for
GRO on a steered group. The two other ways out were rejected. Proving GRO
safe is not possible, because the case above is legal (RFC 9000 §5.2 matches
packets to connections by DCID, not by address). Forwarding a misrouted
datagram to its worker brings back the channel §3 turned down, for a case
that GRO off removes. The cost is one receive per datagram instead of one per
coalesced batch. That is an **estimate**: it was not measured here, and a
worker that needs the batching gets it back from more workers, which is the
point of the design. Each datagram is then steered by its own DCID, so the
connections that share a 4-tuple each reach their own worker (§7, row 9).

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
  IDs, so the reset is safe and stays. The listener gets k and N from
  `QuicServerConfig.workerIndex` and `.workerCount`. The application set
  those from the supervisor's flags (§2.1) and they were checked when the
  listener was built. With the fields unset, as on one process or Darwin, the
  listener resets as today.
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
  application's configuration, which every worker builds the same way at its
  start (prefork passes no keys; each worker reads them from wherever the
  application keeps them, as one process does today). They must survive a restart
  (`QuicServerConfig.statelessResetKey`: "keep across restarts") for §4.4's
  resets to be valid. Each worker wipes its copy on `stop`
  (`http3-server.ts:1251-1252`). No worker holds a key another lacks, so a
  compromised worker learns nothing new.
- **Undefined flag bits** answer -22 before a socket is made, as for the
  existing flags. The runtime knows N only from the bits of the call in hand,
  and it checks them on every call.
- **A wrong k or N** panics where the configuration is used (§2.1), so a
  mis-wired application cannot issue IDs that steer to another worker.

## 7. Test matrix

| # | What | Where | Platforms |
| --- | --- | --- | --- |
| 1 | The flag attaches the program built for the count in bits 8–15. A datagram whose DCID byte 0 is k reaches socket k for short and long headers. Byte 0 ≥ N reaches socket byte mod N. A runt reaches socket 0. -22 for an undefined bit, for flag 2 with flag 4, for flag 4 without flag 1, for flag 4 with a count of 0, and for a count without flag 4; -95 on Darwin | `tests/runtime-test.c` (`test_udp_steer`) | Linux; Darwin for -95 |
| 2 | Every ID a worker issues carries its k: first SCID, NEW_CONNECTION_ID, Retry SCID. With no worker index, IDs are as before | a unit case over `QuicConnection` and `QuicListener` | all |
| 3 | A short-header packet whose byte 0 names another worker gets no stateless reset; byte 0 ≥ N still does | a unit case over `QuicListener` | all |
| 4 | **Two workers; a client completes a request, rebinds its port mid-connection, and the next response reaches the new port from the same worker** (each response names its worker) | `tests/link/net_quic_prefork` | Linux |
| 5 | Initials whose first DCID byte is below N and above it both complete a handshake, and one whose client rebinds between two Initials still completes on one worker | `net_quic_prefork` | Linux |
| 6 | A Retry from worker 1 brings the retried Initial back to worker 1 | `net_quic_prefork` | Linux |
| 7 | Killing worker 1: its client gets a valid stateless reset from the restarted worker 1; worker 0's client finishes its request on the same connection | `net_quic_prefork` | Linux |
| 8 | Index stability: with three workers, kill worker 1; packets with byte 0 = 1 reach the new worker 1, not worker 2 | `net_quic_prefork` | Linux |
| 9 | **Two connections on one 4-tuple** (one client UDP socket), their IDs issued by worker 0 and worker 1, both complete requests, each served by its own worker. The GRO decision is covered by the -22 check: `udpBind` with flags 2 and 4 together answers -22, so a steered socket never has GRO | `net_quic_prefork`; the -22 in `test_udp_steer` | Linux |
| 10 | Darwin runs QUIC with one worker and says so | `net_quic_prefork` | Darwin |
| 11 | No new test. NL2404 refuses `udpBind` under wasm whatever its flags are, and `tests/cases/reject_net_udp_wasm` already covers that | (existing) | wasm32 |
| 12 | `listenUdp` with `NISH_WORKERS=256` panics in the supervisor, right after the count, with the message of §2.1, before any bind or fork; 255 starts | `net_quic_prefork` | Linux |
| 13 | The configuration check panics with §2.1's message for `workerIndex` 2 with `workerCount` 2, for 0 with 0, for -2 with 2 and for 0 with 256. It passes for -1 with 0, for 0 with 1 and for 254 with 255 | a unit case over `QuicListener` and `Http3Server` | all |
| 14 | A refused attach falls back to one worker. In the runtime, `test_udp_steer` forks a child that installs a seccomp filter failing `setsockopt(SO_ATTACH_REUSEPORT_CBPF)` with EPERM. The steered bind then answers -1 and leaves no socket bound, and a bind with flag 1 alone succeeds. In prefork, `NISH_WORKERS=1` binds one UDP socket with flag 1 alone and one TCP listener, and worker 0 reads `--nish-prefork-udp=<fd>,1`. Prefork's own branch after a refusal is not forced in a test. A Nish program cannot install a seccomp filter. That branch is the second bind, the stderr line and the N = 1 path this row tests | `test_udp_steer`; `net_quic_prefork` | Linux |
| 15 | `preforkUdpListener` and `preforkUdpCount` answer -1 and 0 for no flag and for `=5,`, `=,2`, `=5,0`, `=5,256`, `=-1,2` and `=5,2,1`, and 5 and 2 for `=5,2`. `preforkArgs` strips the flag | a unit case over `std/net/prefork.ts` | all |

Row 4 is the acceptance test of the stage. That it fails without steering is
reasoning from §1, not a run: the test needs the stage's own `listenUdp`.
To see it fail, `g6-steer` runs row 4 with the steering flag left off
(sockets bound with flag 1 only). The rebound packet should then be hashed to
the other worker and answered with a reset.

## 8. What `g6-steer` builds

- **Runtime: how N reaches the attach.** `udpBind(host, port, flags)` has no
  worker count, and today it passes only `flags & 1` to `nish_net_bound` as
  `opts` (`runtime-net.c:523-528`), so the TCP `opts & 4` attach (`:265`) is
  never reached from UDP. Three ways were weighed: a new argument or builtin,
  a separate attach call after all N binds, and the count packed into the
  flags. The note chooses the **count in the flags**: flag 4 asks for
  steering, and bits 8–15 carry N (1 to 255). This adds no builtin and no
  signature change, so the only user-visible surface is the flag and its
  bit layout. The GRO rule stays a per-bind check, so every member of the
  group is covered. A separate attach call would check one socket and could
  not see GRO on the others. `nish_udp_bind` checks the bits: -22 for an
  undefined bit, for flag 4 without flag 1, with flag 2 (§5) or with a count
  of 0, and for a count without flag 4. It answers -95 off Linux. After
  `nish_net_bound` returns, it builds §3.1's seven instructions on the stack
  with N as the `mod` constant, unlike TCP's static program, and attaches
  them with `SO_ATTACH_REUSEPORT_CBPF`. On failure it closes the socket and
  returns the error. Every member's bind attaches the same program. The last
  attach wins and is identical, as with TCP flag 4. Until all N are bound, an
  index of N or more falls back to the hash, as measured in §3.1. No datagram
  is handled then, because the supervisor binds all N before it starts a
  worker. This is still a change to `runtime/runtime-net.c` even though
  classic BPF, not eBPF, was chosen; the plan listed that file as "only if
  eBPF". It is about 30–40 lines (**estimate**): the flag checks, the built
  program and the attach and its error path. Because the flag and its bits
  are visible to users, it also needs its `docs/LANGUAGE.md` row (`:10872`),
  the `runtime/nish.d.ts` comment (`:1719`) and the guide page, which are
  outside the plan's file list. The rule "any bit above 3 is -22"
  (`runtime-net.c:524`) changes with it, so the existing assertions that
  pin it are rewritten beside those. Two assertions pass 4 alone:
  `tests/runtime-test.c:931` ("an unknown flag") and
  `tests/cases/net_udp_calls.ts:47`, whose `.out` and comment at `:5` call it
  a bad argument. Flag 4 without flag 1 still answers -22, so their values
  hold, but their reason is no longer "unknown". Each gets a reworded label
  and a companion that passes a bit that is still undefined (8, or 1 << 16).
  The -22 checks come before the -95 check, so flag 4 alone answers -22 on
  Darwin too, as today. `tests/cases/reject_net_udp_wasm` is unaffected: it
  refuses the builtin, whatever the flags are.
- **Prefork:** a UDP group beside the TCP one. `PreforkConfig` gets a
  `listenUdp: boolean`, which needs `listenPort`. It **adds** a group and
  replaces nothing. An HTTP/3 server still needs its TCP listeners, because
  clients find HTTP/3 through an `Alt-Svc` header sent over HTTP/1.1 or
  HTTP/2. The supervisor computes N and panics above 255 (§2.1). Then it binds
  N UDP sockets on `listenHost` and `listenPort`, with flags 1 and 4 and N in
  bits 8–15, or flag 1 alone when N is 1. It binds them **before** the TCP
  group, so a refused attach lowers the count before any TCP listener exists
  (§5). Then it binds the TCP group as today, on the same port number. With
  `listenPort` 0, UDP socket 0 binds any port, and the rest of the UDP group
  and the whole TCP group bind the port it got (`netLocalPort`, as `listen`
  does today, `prefork.ts:776-778`). A TCP bind refused on that number, for
  example because another process holds it, makes `listen` close the TCP
  listeners it bound and the UDP group too, and fail as it does today. It
  does not try another port. With a fixed `listenPort`, a UDP port that is
  taken fails at step 2 of §5. It holds them, and hands worker k both its TCP listener
  (`--nish-prefork-listener=`, as today) and its UDP socket with N
  (`--nish-prefork-udp=<fd>,<N>`, new). The new flag goes before the
  listener flag. `preforkArgs` strips it, and the back-scan in
  `preforkListener` (`prefork.ts:357-368`) widens by one place. A refused
  attach falls back to one worker as §5 lists.
  Three existing options act on the TCP group only:
  - `listenFlags` stays TCP's. Its 2 means `TCP_NODELAY` there. On UDP, 2 is
    GRO, which a steered socket refuses, so the UDP flags are fixed by
    prefork and never take `listenFlags`.
  - `pin`'s CPU steering (TCP flag 4) steers the TCP group as today. The UDP
    group is steered by the DCID instead.
  - `pin`'s `setCpuAffinity(k)` still pins worker k, and `pin` still caps N
    at `availableParallelism()`, so with `pin` the 255 cap is reached only on
    a host with more CPUs than that.

  The names are a proposal; the stage chooses.
- **QUIC:** a worker index and a worker count in `QuicServerConfig`
  (`workerIndex`, default -1, and `workerCount`, default 0; both unset means
  no steering). The application fills them from `preforkIndex(args)` and
  `preforkUdpCount(args)` when `preforkUdpListener(args)` is not -1, and
  leaves them unset otherwise. `QuicListener` and `Http3Server` check the
  pair when they are built (§2.1). With a valid pair,
  `begin` and the NEW_CONNECTION_ID path through `deriveConnectionId`
  (`quic.ts:3363`) write k into byte 0. The Retry SCID is written by
  `QuicListener.retry` (`quic-listener.ts:729`), not by the connection, so
  `QuicListener` needs the worker index too: `retry` writes k into the Retry
  SCID's byte 0, and the listener applies §6's reset rule with N from
  `workerCount`. `Http3Server` passes the configuration through and does not change its routing: the slot index already
  keys on all 8 bytes. `quic-conn-cid.ts`'s table holds the IDs and does not
  care what byte 0 is.

## 9. Not in this stage, on purpose

- **Moving a connection between workers,** for a graceful restart or a
  rebalance. The state is TLS keys, recovery and streams, and moving it is a
  different design.
- **Encrypted worker IDs** (QUIC-LB's encrypted modes). They need AES in the
  steering program, which classic BPF cannot do.
- **Forwarding,** unless a platform that needs it turns up (§3.3).
- **Steering around a dead worker** (§4.4). Attaching a second program
  while worker k restarts would spare the new Initials that would otherwise wait
  for it. The stall is recorded first and measured before anyone builds that.
- **A benchmark of the spread.** An HTTP/3 `BENCH_CORES` path like HTTP/1's
  belongs to G8.
- **A load balancer in front of several hosts.** The byte layout leaves room
  for a server ID in front of k, but nothing reads it.
- **Threads.** WP42 §1 chose processes, and G6 keeps them.
