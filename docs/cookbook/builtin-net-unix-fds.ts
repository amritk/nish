// `nish:net`'s descriptor calls, one call into runtime-net.c each. `sendFd`
// reads its bytes, so its `u8[]` keeps `readonly`; `recvFd` writes both its
// bytes and the descriptor it keeps, and `peerCredentials` writes its three
// numbers, so those arrays travel without it. The range `[off, off + len)` is
// checked in the compiled code before the call, as `netRead`'s is; the length
// of `fd` and `out` is the runtime's to check, which answers -22.
import { peerCredentials, recvFd, sendFd } from "nish:net"

export const give = (sock: i32, fd: i32, note: readonly u8[]): i32 => sendFd(sock, fd, note, 0, note.length)

export const take = (sock: i32, buf: u8[], fd: i32[]): i32 => recvFd(sock, buf, 0, buf.length, fd)

export const who = (sock: i32, out: i32[]): i32 => peerCredentials(sock, out)
