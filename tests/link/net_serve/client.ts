// A loopback HTTP/1.1 client for the serve tests, run as a task in the same
// process as the server it talks to. It writes raw request bytes and reads
// whole responses back, so a test can pipeline, hold a connection open and
// send what a well-behaved client would not.
import { readable, writable } from "nish:async"
import { connectResult, netAddress, netClose, netRead, netWrite, tcpConnect } from "nish:net"

/** One connection and what has been read on it but not yet consumed. */
export class Conn {
  fd: i32 = -1
  buf: u8[]
  start: i32 = 0
  end: i32 = 0
  /** Set once the peer has closed. */
  closed: boolean = false

  constructor(size: i32) {
    this.buf = new Array<u8>(size)
  }
}

/** Connects to the loopback port; the connection's descriptor, or -1. */
export async function dial(conn: Conn, port: i32): Promise<boolean> {
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", port)
  const fd: i32 = tcpConnect(addr)
  if (fd < 0) {
    return false
  }
  await writable(fd)
  if (connectResult(fd) !== 0) {
    netClose(fd)
    return false
  }
  conn.fd = fd
  conn.start = 0
  conn.end = 0
  conn.closed = false
  return true
}

/** Writes all of `text`, waiting while the socket is full. */
export async function sendText(conn: Conn, text: string): Promise<void> {
  const bytes: u8[] = new Array<u8>(text.length)
  for (let i: i32 = 0; i < text.length; i += 1) {
    bytes[i] = toU8(text.charCodeAt(i))
  }
  let at: i32 = 0
  while (at < text.length) {
    const n: i32 = netWrite(conn.fd, bytes, at, text.length - at)
    if (n === -11) {
      await writable(conn.fd)
    } else if (n <= 0) {
      return
    } else {
      at += n
    }
  }
}

/** Reads more bytes into the buffer, compacting it first; false when the peer has closed. */
async function fill(conn: Conn): Promise<boolean> {
  if (conn.start > 0) {
    for (let i: i32 = conn.start; i < conn.end; i++) {
      conn.buf[i - conn.start] = conn.buf[i]
    }
    conn.end -= conn.start
    conn.start = 0
  }
  while (true) {
    const n: i32 = netRead(conn.fd, conn.buf, conn.end, toI32(conn.buf.length) - conn.end)
    if (n === -11) {
      await readable(conn.fd)
      continue
    }
    if (n <= 0) {
      conn.closed = true
      return false
    }
    conn.end += n
    return true
  }
}

/** Where `\r\n\r\n` ends in the unread bytes, or -1. */
function headEnd(conn: Conn): i32 {
  for (let i: i32 = conn.start; i + 3 < conn.end; i++) {
    if (conn.buf[i] === toU8(13) && conn.buf[i + 1] === toU8(10) && conn.buf[i + 2] === toU8(13) && conn.buf[i + 3] === toU8(10)) {
      return i + 4
    }
  }
  return -1
}

/** The value of header `name` (lowercase) in a head, or "". */
export function headerOf(head: string, name: string): string {
  const n: i32 = toI32(name.length)
  let at: i32 = toI32(head.indexOf("\r\n")) + 2
  while (at > 1 && at < toI32(head.length)) {
    let lineEnd: i32 = toI32(head.indexOf("\r\n", at))
    if (lineEnd < 0) {
      lineEnd = toI32(head.length)
    }
    let same: boolean = lineEnd - at > n && head.charCodeAt(at + n) === 58
    for (let i: i32 = 0; i < n && same; i++) {
      let ch: i32 = toI32(head.charCodeAt(at + i))
      if (ch >= 65 && ch <= 90) {
        ch += 32
      }
      same = ch === toI32(name.charCodeAt(i))
    }
    if (same) {
      let v: i32 = at + n + 1
      while (v < lineEnd && head.charCodeAt(v) === 32) {
        v += 1
      }
      return head.substring(v, lineEnd)
    }
    at = lineEnd + 2
  }
  return ""
}

/** One whole response as `status body`, or "closed" when the peer closed first. */
export async function readResponse(conn: Conn): Promise<string> {
  let end: i32 = headEnd(conn)
  while (end < 0) {
    const more: boolean = await fill(conn)
    if (!more) {
      return "closed"
    }
    end = headEnd(conn)
  }
  const head: string = String.fromBytes(conn.buf, conn.start, end)
  const status: string = head.substring(9, 12)
  const length: i32 = toI32(parseInt(headerOf(head, "content-length")))
  const want: i32 = length > 0 ? length : 0
  while (conn.end - end < want) {
    const more: boolean = await fill(conn)
    if (!more) {
      return "closed"
    }
    end = headEnd(conn)
  }
  const body: string = String.fromBytes(conn.buf, end, end + want)
  conn.start = end + want
  const allow: string = headerOf(head, "allow")
  const type: string = headerOf(head, "content-type")
  const tail: string = body.length > 0 ? ` ${body}` : ""
  return `${status} [${type}]${allow.length > 0 ? ` allow=${allow}` : ""}${tail}`
}

/** Closes the connection. */
export function hangUp(conn: Conn): void {
  if (conn.fd >= 0) {
    netClose(conn.fd)
    conn.fd = -1
  }
}

/**
 * One whole response as its bytes, or "closed" when the peer closed first:
 * each CRLF shown as `|`, and the `Date` value as `<date>`, so two runs read
 * the same. A `bodiless` response (to a HEAD) has no body, whatever its
 * `Content-Length` says.
 */
export async function readRaw(conn: Conn, bodiless: boolean): Promise<string> {
  let end: i32 = headEnd(conn)
  while (end < 0) {
    const more: boolean = await fill(conn)
    if (!more) {
      return "closed"
    }
    end = headEnd(conn)
  }
  const head: string = String.fromBytes(conn.buf, conn.start, end)
  const length: i32 = toI32(parseInt(headerOf(head, "content-length")))
  const want: i32 = bodiless || length < 0 ? 0 : length
  while (conn.end - end < want) {
    const more: boolean = await fill(conn)
    if (!more) {
      return "closed"
    }
    end = headEnd(conn)
  }
  const whole: string = String.fromBytes(conn.buf, conn.start, end + want)
  conn.start = end + want
  const date: string = headerOf(head, "date")
  const at: i32 = date.length > 0 ? toI32(whole.indexOf(date)) : -1
  const masked: string = at < 0 ? whole : `${whole.substring(0, at)}<date>${whole.substring(at + toI32(date.length))}`
  let out: string = ""
  let from: i32 = 0
  let crlf: i32 = toI32(masked.indexOf("\r\n"))
  while (crlf >= 0) {
    out = `${out}${masked.substring(from, crlf)}|`
    from = crlf + 2
    crlf = toI32(masked.indexOf("\r\n", from))
  }
  return `${out}${masked.substring(from, toI32(masked.length))}`
}
