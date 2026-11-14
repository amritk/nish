// A request's task keeps its own copy of the request (SERVE-17): `serve`
// reads each request in place in the connection slot's parser and the task
// copies it before its first await. This pins the behaviour, not the copy: a
// task cancelled by its client's hang-up still reads its own method, path,
// header and body after its await, and the next connection on the slot (one
// connection slot, so the second client lands in the slot the first one's
// hang-up freed) gets its own answer. It would pass without the copy too: the
// copy is forced by the region checker (a task that keeps the slot's request
// does not compile), and the loop cancels a hung-up task in the turn its slot
// closes, before the next connection's bytes are read, so no stale read is
// reachable at run time. The client orders its steps by the handler's own
// signals (on the descriptor its request names in `x-signal`), not by fixed sleeps: it hangs up once the first task has started,
// and dials again once that task has run past its await, redialling while the
// loop has yet to free the slot.
import { cancelled, readable, sleep, spawn } from "nish:async"
import { NET_UNIX_STREAM, netClose, netLocalPort, netRead, netWrite, tcpListen, unixSocketPair } from "nish:net"
import { Router, RouterLimits } from "nish/net/router"
import { Request, Response, ServeLimits, ServeStats, serveOn } from "nish/net/serve"
import { Conn, dial, hangUp, readResponse, sendText } from "../net_serve/client"

/** Tells the client one more step happened, on the descriptor its request names in `x-signal`. */
function step(req: Request): void {
  const one: u8[] = [1]
  netWrite(toI32(parseInt(req.header("x-signal"))), one, 0, 1)
}

/** Waits until the handler signals one more step on `fd`. */
async function stepped(fd: i32): Promise<void> {
  await readable(fd)
  const got: u8[] = [0]
  netRead(fd, got, 0, 1)
}

function describe(req: Request): string {
  return `${req.method()} ${req.path()} tag=${req.header("x-tag")} body=${req.text()}`
}

async function handle(req: Request): Promise<Response> {
  if (req.route === 0) {
    step(req)
    const slept: boolean = await sleep(10000)
    console.log(`first, after its await (answered ${slept}, cancelled ${cancelled()}): ${describe(req)}`)
    step(req)
    return new Response(200).text("nobody reads this")
  }
  await sleep(1)
  console.log(`second: ${describe(req)}`)
  return new Response(200).text(req.text())
}

async function client(port: i32, doneFd: i32, signal: i32, signalled: i32): Promise<void> {
  const c: Conn = new Conn(8192)
  await dial(c, port)
  await sendText(c, `POST /first HTTP/1.1\r\nhost: t\r\nx-tag: one\r\nx-signal: ${signalled}\r\ncontent-length: 5\r\n\r\nalpha`)
  await stepped(signal)
  hangUp(c)
  await stepped(signal)
  // The loop frees the one slot in a turn of its own, after the task ends; a
  // connection that comes while the pool is full is closed as it is
  // accepted, before a byte of it is read, so the client dials again until
  // one is answered, rather than guess how long that takes.
  let r: string = "closed"
  for (let tries: i32 = 0; tries < 200 && r === "closed"; tries++) {
    if (tries > 0) {
      await sleep(5)
    }
    const d: Conn = new Conn(8192)
    await dial(d, port)
    await sendText(d, "PUT /second/x HTTP/1.1\r\nhost: t\r\nx-tag: two\r\ncontent-length: 6\r\n\r\nbravo!")
    r = await readResponse(d)
    hangUp(d)
  }
  console.log(`the second client read: ${r}`)
  const one: u8[] = [1]
  netWrite(doneFd, one, 0, 1)
}

export async function main(): Promise<i32> {
  const router: Router = new Router(new RouterLimits())
  router.add("POST", "/first")
  router.add("PUT", "/second/:id")
  const limits: ServeLimits = new ServeLimits()
  limits.connections = 1
  limits.maxRequests = 2
  const listener: i32 = tcpListen("127.0.0.1", 0, 16)
  const port: i32 = netLocalPort(listener)
  const stats: ServeStats = new ServeStats()
  const signal: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, signal)
  const fds: i32[] = [0, 0]
  unixSocketPair(NET_UNIX_STREAM, fds)
  spawn(client(port, fds[1], signal[0], signal[1]))
  const done: i32 = await serveOn(listener, router, limits, handle, stats)
  await readable(fds[0])
  const got: u8[] = [0]
  netRead(fds[0], got, 0, 1)
  netClose(fds[0])
  netClose(fds[1])
  netClose(signal[0])
  netClose(signal[1])
  netClose(listener)
  console.log(`serve: ${done}, answered ${stats.answered}`)
  return 0
}
