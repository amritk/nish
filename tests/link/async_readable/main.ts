// WP49 stage 5: `readable` and `writable` park a task on the executor's
// kernel wait (epoll, kqueue on Darwin) until a descriptor is ready. The
// reader finds nothing to read (-11) and waits; the writer sleeps, waits
// until its end can take bytes, and writes two; the reader wakes and reads
// them. A descriptor that is not open makes no wait and answers `false` at
// once, without suspending `main`.
import { readable, spawn } from "nish:async"
import { NET_UNIX_STREAM, unixSocketPair } from "nish:net"
import { reader, writer } from "./lib"

export async function main(): Promise<i32> {
  const fds: i32[] = [0, 0]
  if (unixSocketPair(NET_UNIX_STREAM, fds) < 0) {
    return 1
  }
  spawn(reader(fds[0]))
  spawn(writer(fds[1]))
  const closed = await readable(-1)
  console.log(`main: readable(-1) ${closed}`)
  return 0
}
