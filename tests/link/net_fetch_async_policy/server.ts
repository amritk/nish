// The scripted loopback server the policy checks fetch from, in the same
// process. Each connection is a task of its own, given its accept number,
// which `/conn` answers so a check can tell a reused connection from a new
// one. `/keep...` keeps its connection open for the next request; anything
// else closes it after the answer.
import { readable, spawn } from "nish:async"
import { netClose, netRead, tcpAccept } from "nish:net"
import { writeText } from "../net_fetch_async/server"

/** One request as the server read it: its head and its body, "" when the peer left. */
class Request {
  head: string = ""
  target: string = ""
  body: string = ""
}

/** The value of `name:` in `head`, or "" without one. */
function field(head: string, name: string): string {
  const at: i32 = head.indexOf(`\r\n${name}: `)
  if (at < 0) {
    return ""
  }
  const from: i32 = at + name.length + 4
  const rest: string = head.substring(from, head.length)
  return rest.substring(0, rest.indexOf("\r\n"))
}

/** A non-negative decimal's value; -1 for anything else. */
function decimal(s: string): i32 {
  if (s.length === 0) {
    return -1
  }
  let v: i32 = 0
  for (let i: i32 = 0; i < s.length; i += 1) {
    const ch: i32 = toI32(s.charCodeAt(i))
    if (ch < 48 || ch > 57) {
      return -1
    }
    v = v * 10 + ch - 48
  }
  return v
}

/** Reads one request from `fd`, its body by Content-Length. */
async function readRequest(fd: i32): Promise<Request> {
  const req: Request = new Request()
  const buf: u8[] = new Array<u8>(8192)
  let len: i32 = 0
  let need: i32 = -1
  while (len < 8192) {
    if (need >= 0 && len >= need) {
      break
    }
    const n: i32 = netRead(fd, buf, len, 8192 - len)
    if (n === -11) {
      const ok = await readable(fd)
      if (!ok) {
        return req
      }
      continue
    }
    if (n <= 0) {
      return req
    }
    len += n
    if (need < 0) {
      const text: string = String.fromBytes(buf, 0, len)
      const end: i32 = text.indexOf("\r\n\r\n")
      if (end >= 0) {
        const head: string = text.substring(0, end + 2)
        const bodyLen: i32 = decimal(field(head, "Content-Length"))
        need = end + 4 + (bodyLen > 0 ? bodyLen : 0)
        req.head = head
      }
    }
  }
  if (need < 0) {
    return req
  }
  const all: string = String.fromBytes(buf, 0, need)
  const headEnd: i32 = req.head.length + 2
  req.body = all.substring(headEnd, all.length)
  const first: string = req.head.substring(0, req.head.indexOf("\r\n"))
  const rest: string = first.substring(first.indexOf(" ") + 1, first.length)
  req.target = rest.substring(0, rest.indexOf(" "))
  return req
}

/** The head of an answer with `status`, `extra` fields and a body of `length`. */
function head(status: string, extra: string, length: i32, close: boolean): string {
  const connection: string = close ? "Connection: close\r\n" : ""
  return `HTTP/1.1 ${status}\r\n${extra}Content-Length: ${length}\r\n${connection}\r\n`
}

/** Answers the requests on one connection, the `id`th accepted. */
export async function answerScripted(fd: i32, id: i32, port: i32): Promise<void> {
  while (true) {
    const req: Request = await readRequest(fd)
    const target: string = req.target
    if (target.length === 0) {
      break
    }
    const keep: boolean = target.startsWith("/keep")
    let status: string = "200 OK"
    let extra: string = ""
    let body: string = ""
    if (target.startsWith("/echo") || target.startsWith("http://")) {
      body = `${req.head}\r\n${req.body}`
    } else if (target.endsWith("/conn")) {
      body = `${id}`
    } else if (target === "/to-echo") {
      status = "302 Found"
      extra = "Location: /echo\r\n"
    } else if (target === "/to-other") {
      status = "302 Found"
      extra = `Location: http://localhost:${port}/echo\r\n`
    } else if (target === "/loop") {
      status = "302 Found"
      extra = "Location: /loop\r\n"
    } else if (target === "/big") {
      body = "0123456789012345678901234567890123456789"
    } else {
      status = "404 Not Found"
    }
    await writeText(fd, `${head(status, extra, body.length, !keep)}${body}`)
    if (!keep) {
      break
    }
  }
  netClose(fd)
}

/** Shared by `serve` and the checks: set `stopping` to end the accept loop. */
export class Control {
  stopping: boolean = false
}

/**
 * Accepts on `listen`, each connection a task of its own, until a
 * connection comes in after `control.stopping` is set; then closes it and
 * the listener. Awaited beside the checks rather than spawned, since a
 * spawned task takes no object.
 */
export async function serveScripted(listen: i32, port: i32, control: Control): Promise<i32> {
  const peer: u8[] = new Array<u8>(32)
  let id: i32 = 0
  while (!control.stopping) {
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
    if (control.stopping) {
      netClose(fd)
      break
    }
    id += 1
    spawn(answerScripted(fd, id, port))
  }
  netClose(listen)
  return id
}
