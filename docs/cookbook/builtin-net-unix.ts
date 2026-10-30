// `nish:net`'s Unix-domain calls, one call into runtime-net.c each. A path is
// a `string` the runtime copies into `sun_path`, `readonly nocapture`; a
// leading "@" names the abstract namespace. Listening and connecting never
// wait, so they keep `willreturn`; `unixAccept` is `nounwind` alone, as
// `tcpAccept` is. `unixSocketPair` fills an `i32[]` and so travels as its
// header without `readonly`; the runtime answers -22 for one shorter than 2,
// and `NET_UNIX_STREAM` folds to its value, 1.
import { NET_UNIX_STREAM, unixAccept, unixConnect, unixListen, unixSocketPair } from "nish:net"

export const serve = (backlog: i32): i32 => unixListen("@app", backlog, 0)

export const dial = (): i32 => unixConnect("@app")

export const take = (fd: i32): i32 => unixAccept(fd)

export const pair = (fds: i32[]): i32 => unixSocketPair(NET_UNIX_STREAM, fds)
