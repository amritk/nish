# Unix sockets

A Unix-domain socket connects two processes on the same machine through a
name in the filesystem, or, on Linux, through a name in the abstract
namespace that leaves no file behind. `nish:net` gives a program stream
listeners, connections and connected pairs. Each answers a descriptor the
rest of [`nish:net`](networking.md) takes as it is: `netRead`, `netWrite`,
`netShutdown`, `netClose` and the readiness loop treat it as they treat a TCP
socket. The rules are in the reference,
[Unix-domain sockets](../../LANGUAGE.md#unix-domain-sockets).

Like the rest of `nish:net`, these calls are native only, never block, and
answer an `i32`: a descriptor or `0` on success, a negated error number on a
failure.

| Call | Answers |
| --- | --- |
| `unixListen(path, backlog, flags)` | a listening socket, its file at mode 0600 |
| `unixListenMode(path, backlog, flags, mode)` | the same, its file at `mode` (0 to 0777) |
| `unixConnect(path)` | a connected socket |
| `unixAccept(fd)` | the next waiting connection, or `-11` when there is none |
| `unixSocketPair(kind, fds)` | `0`, with two connected ends in `fds[0]` and `fds[1]` |

## A listener and a client

A path that starts with `@` is an abstract name: Linux keeps it in memory,
and it goes away with the last socket bound to it. Any other path makes a
socket file. The client connects with the same name, and the listener takes
the connection once the loop says it is readable.

```ts nish:ok
import {
  netClose,
  netRead,
  netWrite,
  pollAdd,
  pollCreate,
  pollWait,
  unixAccept,
  unixConnect,
  unixListen,
} from "nish:net";

export const main = (): i32 => {
  const server = unixListen("@guide-unix-echo", 16, 0);
  if (server < 0) {
    console.log(`listen failed: ${server}`);
    return 1;
  }
  const client = unixConnect("@guide-unix-echo");
  const loop = pollCreate();
  pollAdd(loop, server, 1, 0);
  const ready: i32[] = [0, 0];
  const buf = new Array<u8>(64);
  if (client >= 0 && pollWait(loop, ready, 1000) > 0) {
    const conn = unixAccept(server);
    const hello: u8[] = [104, 105];
    netWrite(client, hello, 0, hello.length);
    pollAdd(loop, conn, 1, 1);
    if (pollWait(loop, ready, 1000) > 0) {
      console.log(`read ${netRead(conn, buf, 0, buf.length)} bytes`);
    }
    netClose(conn);
  }
  netClose(client);
  netClose(loop);
  netClose(server);
  return 0;
};
```

macOS has no abstract namespace: a name starting with `@` answers `-95`
there, so a program meant for both uses a path. A socket file whose name
starts with `@` is spelled `./@name`.

The flags and the kinds are small numbers that other `nish:net` constants
share: `NET_UNIX_UNLINK_STALE` and `NET_UNIX_STREAM` are both `1`, the same
as `NET_TCP_NODELAY`, so the compiler cannot catch one passed for another.
Name the constant the call documents.

## The socket file

A listener on a path makes its file when it binds, and closing the listener
leaves the file behind. Remove it yourself with `unlinkSync` from `nish:fs`
once the server stops.

- **Who may connect.** Connecting needs write permission on the file.
  `unixListen` gives it mode 0600, so only its owner can connect, whatever the
  umask; `unixListenMode` takes another mode, such as `0o660` for a group.
  The mode is set before the listener accepts anyone.
- **A path that already exists** answers `-98`. A file left by a server that
  crashed is the usual case: pass `NET_UNIX_UNLINK_STALE` as the flags, and
  `unixListen` removes a socket file nobody listens on and binds again. A
  live listener's file is still `-98`, and anything that is not a socket,
  such as a regular file, is `-17` and left alone. On macOS the flag answers
  `-95` once it meets a socket file: there a listener whose backlog is full
  refuses a connect just as a dead file does, so the runtime cannot tell
  them apart and removes nothing.
- **The directory is what protects it.** Whoever can write the socket's
  directory can replace the file, so put it in a directory only its owner can
  write, such as `$XDG_RUNTIME_DIR`.
- **Length.** A path longer than the kernel's limit, 107 bytes on Linux and
  103 on macOS, answers `-36`. The limit is on the path as written, so a
  relative path counts only its own bytes; it is resolved from the working
  directory.

```ts nish:ok
import { NET_UNIX_UNLINK_STALE, netClose, unixListenMode } from "nish:net";
import { unlinkSync } from "nish:fs";

export const main = (): i32 => {
  const server = unixListenMode("guide-app.sock", 16, NET_UNIX_UNLINK_STALE, 0o660);
  console.log(server >= 0 ? "listening" : `failed: ${server}`);
  if (server >= 0) {
    netClose(server);
    unlinkSync("guide-app.sock");
  }
  return 0;
};
```

## A connected pair

`unixSocketPair(kind, fds)` makes two sockets already connected to each other,
with no name at all: what one end writes, the other reads, so a program can
hand one end to a thread and keep the other. `fds` is an
`i32[]` of at least two; a shorter one answers `-22`.

`NET_UNIX_STREAM` is a byte stream, as a TCP connection is: two writes may
arrive as one read. `NET_UNIX_SEQPACKET` keeps each write one message, so each
read answers exactly one; it is Linux only and answers `-95` on macOS.

```ts nish:ok
import { NET_UNIX_SEQPACKET, netClose, netRead, netWrite, unixSocketPair } from "nish:net";

export const main = (): i32 => {
  const fds: i32[] = [0, 0];
  if (unixSocketPair(NET_UNIX_SEQPACKET, fds) !== 0) {
    return 1;
  }
  const one: u8[] = [1, 2];
  const two: u8[] = [3];
  netWrite(fds[0], one, 0, one.length);
  netWrite(fds[0], two, 0, two.length);
  const buf = new Array<u8>(16);
  console.log(netRead(fds[1], buf, 0, buf.length));
  console.log(netRead(fds[1], buf, 0, buf.length));
  netClose(fds[0]);
  netClose(fds[1]);
  return 0;
};
```

## Under `--sandbox`

A Unix socket needs the `net` capability, which any of these calls reaches. A
listener on a path also makes a file, which the kernel counts as a write: in
a program that does not reach `fs.write`, `unixListen("app.sock", …)` answers
`-13` and makes nothing. The compiler cannot see the path, so it does not
grant `fs.write` for you; reach it elsewhere, or use an abstract name. On a
kernel recent enough to scope abstract sockets, a sandboxed program can still
listen on and connect to its own abstract names, but connecting to one made
outside the sandbox answers `-1`. [The sandbox](sandbox.md) has the rest.

## Under Node

The `NET_UNIX_` constants read under Node as they do natively, and each of the
five calls throws: there is no Node equivalent this layer maps onto.
