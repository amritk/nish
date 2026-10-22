# Networking

`nish:net` gives a program TCP and UDP sockets and a loop that waits for
whichever of them is ready. It is a thin layer: every socket is non-blocking,
there is no `async` and no callback, and your `main` is the loop. The protocol
stack on top of it (TLS, HTTP/1.1, HTTP/2, HTTP/3) is in the
[standard library](standard-library.md); this page is about the sockets
themselves. The rules are in the reference,
[`nish:net`](../../LANGUAGE.md#nishnet-addresses-non-blocking-tcp-and-udp-and-the-readiness-loop).

Every function is also a global, as every `nish:` export is, but importing them
says where they come from. They are native only: a `wasm32` build has no
sockets, and the compiler refuses a call to any of them there.

## Errors are numbers

Every call answers an `i32`. Zero or more is success: a descriptor, a count of
bytes, or `0`. A negative number is the failure's error number, negated, and
the ones a loop branches on are the same on every platform:

| Answer | Meaning |
| --- | --- |
| `-11` | would block: nothing to read, no room to write, nobody waiting to be accepted. Call again once the loop says the socket is ready |
| `-32` | the peer has gone. Writing to it never kills the process with `SIGPIPE` |
| `-98` | the port is already in use |
| `-111` | the connection was refused |
| `-22` | a bad argument: a host that is not a numeric address, a flag that does not exist |

Hosts are numeric literals, `"127.0.0.1"` or `"::1"`, because there is no name
resolution. `"::"` listens on every address, IPv4 and IPv6 both.

## A server

`tcpListen(host, port, backlog)` opens a listening socket; port `0` lets the
kernel choose one, and `netLocalPort(fd)` tells you which. `tcpAccept(fd,
peer)` takes the next waiting connection and writes its address into `peer`,
an 18-byte `u8[]`. `netRead` and `netWrite` move bytes between a socket and a
range of a `u8[]`, and `netClose` closes it.

To wait, make a loop with `pollCreate()`, watch each socket with
`pollAdd(loop, fd, events, token)` — `1` for readable, `2` for writable, and a
`token` you choose to tell the sockets apart — and call
`pollWait(loop, ready, timeoutMs)`. It fills `ready` with pairs, a token and
its events, and answers how many, `0` when the timeout passed.

```ts nish:ok
import { netClose, netLocalPort, netRead, netWrite, pollAdd, pollCreate, pollWait, tcpAccept, tcpListen } from "nish:net";

export const main = (): i32 => {
  const server = tcpListen("127.0.0.1", 0, 16);
  if (server < 0) {
    return 1;
  }
  console.log(`listening on ${netLocalPort(server)}`);
  const loop = pollCreate();
  pollAdd(loop, server, 1, 0);
  const ready: i32[] = [0, 0];
  const peer = new Array<u8>(18);
  const buf = new Array<u8>(4096);
  // Wait up to a second for one client, and echo back what it sends first.
  if (pollWait(loop, ready, 1000) > 0) {
    const conn = tcpAccept(server, peer);
    if (conn >= 0) {
      pollAdd(loop, conn, 1, 1);
      if (pollWait(loop, ready, 1000) > 0) {
        const n = netRead(conn, buf, 0, buf.length);
        if (n > 0) {
          netWrite(conn, buf, 0, n);
        }
      }
      netClose(conn);
    }
  }
  netClose(server);
  netClose(loop);
  return 0;
};
```

A real server keeps accepting until `tcpAccept` answers `-11`, keeps reading
until `netRead` does, and holds on to what `netWrite` could not send yet. The
loop is level-triggered: anything you leave unread is reported again on the
next `pollWait`.

## Sharing a port and turning Nagle off: `tcpListenFlags`

`tcpListenFlags(host, port, backlog, flags)` is `tcpListen` with one more
argument, a set of flags added together. Flag `1` sets `SO_REUSEPORT`, which lets several listeners that all
ask for it open the same port, each with its own queue of waiting connections:

- **On Linux** the kernel spreads new connections across them. Start the same
  server several times, each process with its own listener on one port, and
  the connections are shared between the processes without a load balancer in
  front. Only listeners started by the same user may share.
- **On macOS** they share the port, but one listener takes the connections. It
  still lets a new copy of a server open the port before the old one closes,
  so a restart drops nothing.

Flag `2` sets `TCP_NODELAY` on every connection `tcpAccept` takes from the
listener, on every platform. Without it the kernel may hold a small write back
until the peer acknowledges the last one (Nagle's algorithm), which saves
packets for a stream of tiny writes and costs a round trip for a server that
answers each request with one small write. The bytes that arrive are the same
either way; only when they leave changes.

Flag `0` is `tcpListen` exactly, `3` is both, and any other bit answers `-22`.
A listener without flag `1` cannot open a port a listener with it holds, nor
the other way round: both answer `-98`.

```ts nish:ok
import { netClose, netLocalPort, tcpListenFlags } from "nish:net";

export const main = (): i32 => {
  const first = tcpListenFlags("127.0.0.1", 0, 64, 1);
  if (first < 0) {
    return 1;
  }
  const port = netLocalPort(first);
  // The same port again: allowed, because both listeners asked for it.
  const second = tcpListenFlags("127.0.0.1", port, 64, 1);
  console.log(`${second >= 0}`); // true
  console.log(`${tcpListenFlags("127.0.0.1", port, 64, 4)}`); // -22
  netClose(second);
  netClose(first);
  return 0;
};
```

A program can watch both listeners in one loop, as in the server above, and
accept from whichever is ready. A server that wants both the shared port and
its small answers sent at once opens each listener with `3`.

## A server on every core: `nish/net/prefork`

A Nish server is one thread. To use every core, run one copy of it per core,
each with its own `SO_REUSEPORT` listener on the same port: that is what
`nish/net/prefork` does. Call `preforkWorkers(process.argv)` at the top of
`main`, before you open a listener:

```ts nish:ok
import { netClose, tcpListenFlags } from "nish:net";
import { PREFORK_STOPPED, preforkWorkers } from "nish/net/prefork";

export const main = (): i32 => {
  const worker = preforkWorkers(process.argv);
  if (worker < 0) {
    // The process you started: every worker has exited.
    return worker === PREFORK_STOPPED ? 0 : 1;
  }
  // A worker, numbered from 0: open its own listener and serve.
  const listener = tcpListenFlags("0.0.0.0", 8080, 1024, 1);
  if (listener < 0) {
    return 1;
  }
  // ... the readiness loop of a one-process server, unchanged ...
  netClose(listener);
  return 0;
};
```

The program runs in two roles. The process you start becomes the supervisor:
it starts the program again once per worker, and `preforkWorkers` answers it
only when they have all exited, with `-1` (`PREFORK_STOPPED`) after a shutdown
or `-2` (`PREFORK_SPAWN_FAILED`) when a worker's first start failed or the
supervisor could not set up its signal handling, in which case no worker
starts. In each
worker it answers that worker's index, `0` up to one less than the count, at
once. A worker is told its index by one extra argument at the end of its
arguments; `preforkArgs(process.argv)` gives you the arguments without it, the
same list in every process, so read your port and options from that. Workers
share nothing, so each one is the single-threaded server it was before.

- **How many workers.** The `NISH_WORKERS` environment variable when it is a
  positive whole number, such as `NISH_WORKERS=2`; anything else in it is
  ignored. Otherwise one per core on Linux, and one on macOS, which lets the
  listeners share the port but does not spread connections across them. The
  count has no upper bound, so set `NISH_WORKERS` yourself; never pass it on
  from a client.
- **Restarts.** A worker that exits, whatever its exit code, or is killed, is
  started again at the same index. One that dies within a second of starting
  waits first: 100 ms, then twice as long each time it does so again, up to
  5 s. A server that crashes on start costs one start every few seconds, not
  a core. A restart the system refuses (out of processes or memory) waits the
  same way and is tried again.
- **Stopping.** SIGTERM or SIGINT (Ctrl-C) to the supervisor sends SIGTERM to
  every worker and waits up to 5 s for them, then kills the rest; a second
  signal kills them at once. The supervisor then exits with the `-1` path
  above. A supervisor stopped any other way (SIGKILL, the out-of-memory
  killer, SIGHUP or SIGQUIT) leaves its workers running; stop it with SIGTERM.

`preforkWith(process.argv, config)` takes a `PreforkConfig` to change those
numbers: `workers`, `backoffMs`, `backoffCapMs`, `quickExitMs` (what counts as
dying young), `graceMs` and `tickMs` (how often the supervisor looks for a
restart that is due). A negative number, a `tickMs` or `backoffMs` of zero,
or a `backoffCapMs` below `backoffMs` stops the program with a panic naming
the field. `examples/prefork-server.ts` is a whole HTTP server built this way:
each answer names the worker that sent it, so a few `curl`s show the spread.

## Trusting a peer's address

A TCP peer's address is proven: the handshake that `tcpAccept` completes needs
answers sent to it. A UDP datagram's source address is only what its sender
wrote, so anyone can send one that names another host. A server that caps or
allows clients by address keys that on a UDP address only once a handshake has
proven it. For QUIC, `Http3Server.addresses[slot]` is the source of the slot's
first datagram, and it is proven once `server.quic(slot).addressValidated` is
set: by a Handshake packet from the client, or by a Retry token when the
server's config turns `retry` on. The relay example in `examples/relay` counts
a client against its per-address cap only from that point.

## Under Node

A program that uses `nish:net` type-checks with `npm run check`, but it has no
reading under Node: Node's sockets become ready only to Node's own event loop,
which a program that owns its loop never returns to, so each call throws there.
Run it natively.
