// A loopback HTTP/1.1 server in the same process as the fetches it answers,
// so the test needs no other program. `serve` accepts `count` connections
// and gives each a task of its own; `/slow/...` is answered only after a
// sleep, anything else at once. Every answer closes its connection.
import { readable, sleep, spawn, writable } from "nish:async"
import { netClose, netRead, netWrite, tcpAccept } from "nish:net"

/** Reads one request head from `fd`; its target, or "" when the peer left first. */
export async function readTarget(fd: i32): Promise<string> {
  const buf: u8[] = new Array<u8>(4096)
  let len: i32 = 0
  while (len < 4096) {
    const n: i32 = netRead(fd, buf, len, 4096 - len)
    if (n === -11) {
      const ok = await readable(fd)
      if (!ok) {
        return ""
      }
      continue
    }
    if (n <= 0) {
      return ""
    }
    len += n
    const head: string = String.fromBytes(buf, 0, len)
    if (head.indexOf("\r\n\r\n") >= 0) {
      const first: string = head.substring(0, head.indexOf("\r\n"))
      const rest: string = first.substring(first.indexOf(" ") + 1, first.length)
      return rest.substring(0, rest.indexOf(" "))
    }
  }
  return ""
}

/** Writes all of `text` to `fd`, waiting while the socket is full. */
export async function writeText(fd: i32, text: string): Promise<void> {
  const bytes: u8[] = new Array<u8>(text.length)
  for (let i: i32 = 0; i < text.length; i += 1) {
    bytes[i] = toU8(text.charCodeAt(i))
  }
  let at: i32 = 0
  while (at < text.length) {
    const n: i32 = netWrite(fd, bytes, at, text.length - at)
    if (n === -11) {
      await writable(fd)
    } else if (n <= 0) {
      return
    } else {
      at += n
    }
  }
}

/** Answers one connection. */
export async function answer(fd: i32, delayMs: i32): Promise<void> {
  const target = await readTarget(fd)
  if (target.startsWith("/slow")) {
    await sleep(delayMs)
  }
  await reply(fd, `hello from ${target}`)
}

/** Writes a 200 answer carrying `body` to `fd`, then closes it. */
export async function reply(fd: i32, body: string): Promise<void> {
  await writeText(fd, `HTTP/1.1 200 OK\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n${body}`)
  netClose(fd)
}

/**
 * Accepts one connection on `listen`, polling every 5 ms for at most
 * `waitMs`; the descriptor, or -1 when none came in time.
 */
export async function acceptWithin(listen: i32, waitMs: i32): Promise<i32> {
  const peer: u8[] = new Array<u8>(32)
  let waited: i32 = 0
  while (waited <= waitMs) {
    const fd: i32 = tcpAccept(listen, peer)
    if (fd !== -11) {
      return fd
    }
    await sleep(5)
    waited += 5
  }
  return -1
}

/** Accepts `count` connections on `listen`, each answered by a task of its own, then closes it. */
export async function serve(listen: i32, count: i32, delayMs: i32): Promise<void> {
  const peer: u8[] = new Array<u8>(32)
  let served: i32 = 0
  while (served < count) {
    const fd: i32 = tcpAccept(listen, peer)
    if (fd === -11) {
      const ok = await readable(listen)
      if (!ok) {
        break
      }
      continue
    }
    if (fd < 0) {
      break
    }
    spawn(answer(fd, delayMs))
    served += 1
  }
  netClose(listen)
}
