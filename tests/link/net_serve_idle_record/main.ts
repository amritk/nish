// An idle keep-alive connection holds no request record: a slot keeps one
// only from the head's parse to its task's copy, then gives it back for the
// next exchange on any connection. The client opens `IDLE` connections one
// at a time, sends one request with a `BODY`-byte body on each, reads the
// answer and leaves the connection open. The body goes `PACE` bytes at a
// time, with a turn of the loop (`sleep(0)`) between, so the server can read
// each before the next is sent, the carrier's input buffer stays small and
// what is left is the record: its body buffer
// grows to the body, so a record kept per slot keeps `BODY` bytes or more
// per idle connection (130 KiB measured), and one given back is reused
// (2 KiB measured). The process's peak resident set (VmHWM) may rise by at
// most `PER_IDLE` KiB per connection after the first `WARM`. VmHWM is
// Linux's: elsewhere nothing is measured, the check reads true, and the
// probe says so on stderr.
import { readable, sleep, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { platform } from "nish:process"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"
import { Conn, dial, readResponse, sendText } from "../net_serve/client"

/** Connections answered before the peak is first read. */
const WARM: i32 = 8
/** Connections answered, then left idle, after it. */
const IDLE: i32 = 200
/** Each request's body, in bytes. */
const BODY: i32 = 65536
/** The body is sent this many bytes at a time, yielding one loop turn between, so the server can read each before the next. */
const PACE: i32 = 4096
/** The most the peak may rise for each idle connection, in KiB: half `BODY`. */
const PER_IDLE: i64 = 32

async function handle(req: Request): Promise<Response> {
  if (req.route === 0) {
    return new Response(200).text(`item ${req.paramNumber(0)} of ${req.text().length} bytes`)
  }
  return refuse(req)
}

declare function open(path: string, flags: i32): i32
declare function read(fd: i32, buf: u8[], n: u64): i64
declare function close(fd: i32): i32

/** This process's peak resident set in KiB, the `VmHWM` line of /proc/self/status; 0 off Linux, -1 unread. */
function peakKib(): i64 {
  if (platform !== "linux") {
    return 0
  }
  const fd: i32 = open("/proc/self/status", 0)
  if (fd < 0) {
    return -1
  }
  const buf: u8[] = new Array<u8>(8192)
  const n: i32 = toI32(read(fd, buf, toU64(buf.length)))
  close(fd)
  if (n <= 0) {
    return -1
  }
  const status: string = String.fromBytes(buf, 0, n)
  const at: i32 = status.indexOf("VmHWM:")
  if (at < 0) {
    return -1
  }
  let from: i32 = at + 6
  while (from < status.length && (status.charCodeAt(from) === 32 || status.charCodeAt(from) === 9)) {
    from += 1
  }
  return toI64(parseInt(status.substring(from, status.indexOf(" kB", at))))
}

async function client(port: i32, doneFd: i32): Promise<void> {
  const open: i32[] = new Array<i32>(WARM + IDLE)
  let chunk: string = "0123456789abcdef"
  while (chunk.length < PACE) {
    chunk = chunk + chunk
  }
  let bad: i32 = 0
  let warm: i64 = 0
  for (let i: i32 = 0; i < WARM + IDLE; i++) {
    const c: Conn = new Conn(1024)
    const dialled: boolean = await dial(c, port)
    await sendText(c, `POST /items/${i} HTTP/1.1\r\nhost: t\r\ncontent-length: ${BODY}\r\n\r\n`)
    for (let sent: i32 = 0; sent < BODY; sent += chunk.length) {
      await sendText(c, chunk)
      const paced: boolean = await sleep(0)
      if (!paced) {
        bad += 1
      }
    }
    const r: string = await readResponse(c)
    if (!dialled || r !== `200 [text/plain; charset=utf-8] item ${i} of ${BODY} bytes`) {
      bad += 1
    }
    open[i] = c.fd
    if (i + 1 === WARM) {
      warm = peakKib()
    }
  }
  const last: i64 = peakKib()
  if (platform !== "linux") {
    console.error(`peak RSS: skipped, not measured on ${platform} (no VmHWM)`)
  }
  console.log(`client: ${WARM + IDLE} connections answered once, ${bad} wrong`)
  console.log(`peak RSS read: ${warm >= 0 && last >= 0}`)
  console.log(`peak RSS per idle connection at most ${PER_IDLE} KiB: ${last - warm <= PER_IDLE * toI64(IDLE)}`)
  console.error(`peak RSS ${warm} KiB after ${WARM}, ${last} KiB after ${WARM + IDLE}: ${(last - warm) / toI64(IDLE)} KiB per idle connection`)
  for (let i: i32 = 0; i < WARM + IDLE; i++) {
    netClose(open[i])
  }
  const one: u8[] = [1]
  netWrite(doneFd, one, 0, 1)
}

export async function main(): Promise<i32> {
  const router: Router = new Router(new RouterLimits())
  router.add("POST", "/items/:id")
  const limits: ServeLimits = new ServeLimits()
  limits.maxRequests = WARM + IDLE
  limits.connections = WARM + IDLE + 8
  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  const port: i32 = netLocalPort(listener)
  const stats: ServeStats = new ServeStats()
  const fds: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, fds)
  spawn(client(port, fds[1]))
  const done: i32 = await serveOn(listener, router, limits, handle, stats)
  await readable(fds[0])
  const got: u8[] = [0]
  netRead(fds[0], got, 0, 1)
  netClose(fds[0])
  netClose(fds[1])
  netClose(listener)
  console.log(`serve: ${done}, answered ${stats.answered}`)
  return 0
}
