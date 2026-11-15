// Thousands of keep-alive requests on one connection, one at a time: the
// process's peak resident set (VmHWM in /proc/self/status) after the last
// answer is within `BAND` of what it was after the warm-up, so `serve` keeps
// no memory per request beyond what a task's region frees. The client runs
// in the same process, one task per round with its own `Conn` on the same
// descriptor, so its own garbage goes with each round's region. The 256 KiB
// band over the 4500 requests after the warm-up catches a leak of about 58
// bytes per request or more; a smaller one passes. VmHWM is Linux's:
// elsewhere nothing is measured, the comparison reads 0 twice, and the probe
// says so on stderr (its stdout stays the same on every platform, as the
// macOS net_ job compares it).
import { readable, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { platform } from "nish:process"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, refuse, serveOn } from "nish/net/serve"
import { Conn, dial, hangUp, readResponse, sendText } from "../net_serve/client"

const WARM_ROUNDS: i32 = 10
const ROUNDS: i32 = 100
const BATCH: i32 = 50
/** How far the peak may rise after the warm-up, in KiB. */
const BAND: i64 = 256

async function handle(req: Request): Promise<Response> {
  if (req.route === 0) {
    return new Response(200).text(`item ${req.paramNumber(0)} of ${req.text().length} bytes`)
  }
  return refuse(req)
}

declare function open(path: string, flags: i32): i32
declare function read(fd: i32, buf: u8[], n: u64): i64
declare function close(fd: i32): i32

/** This process's peak resident set in KiB, the `VmHWM` line of /proc/self/status (which reads as empty to a sized read); 0 off Linux, -1 unread. */
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

/** One round on the connection `fd`: `BATCH` requests, each sent once the one before it is answered; writes 1 to `doneFd` if all came back right, else 0. */
async function round(fd: i32, first: i32, doneFd: i32): Promise<void> {
  const c: Conn = new Conn(8192)
  c.fd = fd
  let ok: boolean = true
  for (let i: i32 = 0; i < BATCH; i++) {
    const n: i32 = first + i
    await sendText(c, `POST /items/${n} HTTP/1.1\r\nhost: t\r\ncontent-length: 7\r\n\r\npayload`)
    const r: string = await readResponse(c)
    if (r !== `200 [text/plain; charset=utf-8] item ${n} of 7 bytes`) {
      ok = false
    }
  }
  const out: u8[] = [ok ? 1 : 0]
  netWrite(doneFd, out, 0, 1)
}

async function client(port: i32, doneFd: i32): Promise<void> {
  const c: Conn = new Conn(8192)
  await dial(c, port)
  const fds: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, fds)
  const got: u8[] = [0]
  let bad: i32 = 0
  let warm: i64 = 0
  for (let r: i32 = 0; r < ROUNDS; r++) {
    spawn(round(c.fd, r * BATCH, fds[1]))
    await readable(fds[0])
    netRead(fds[0], got, 0, 1)
    if (got[0] !== toU8(1)) {
      bad += 1
    }
    if (r + 1 === WARM_ROUNDS) {
      warm = peakKib()
    }
  }
  const last: i64 = peakKib()
  if (platform !== "linux") {
    console.error(`peak RSS: skipped, not measured on ${platform} (no VmHWM)`)
  }
  console.log(`client: ${ROUNDS * BATCH} answered, ${bad} round(s) wrong`)
  console.log(`peak RSS read: ${warm >= 0 && last >= 0}`)
  console.log(`peak RSS after ${ROUNDS * BATCH} requests within ${BAND} KiB of after ${WARM_ROUNDS * BATCH}: ${last - warm <= BAND}`)
  if (last - warm > BAND) {
    console.log(`  after the warm-up ${warm} KiB, at the end ${last} KiB`)
  }
  hangUp(c)
  netClose(fds[0])
  netClose(fds[1])
  const one: u8[] = [1]
  netWrite(doneFd, one, 0, 1)
}

export async function main(): Promise<i32> {
  const router: Router = new Router(new RouterLimits())
  router.add("POST", "/items/:id")
  const limits: ServeLimits = new ServeLimits()
  limits.maxRequests = ROUNDS * BATCH
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
