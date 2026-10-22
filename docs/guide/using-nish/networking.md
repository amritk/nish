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
