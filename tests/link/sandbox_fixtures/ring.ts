// A `--sandbox` probe whose main reaches net and a `NET_LISTEN_RING` listen
// but not process.spawn (WP63 S3): the sandbox makes its restricted rings
// before the filter loads. `<exe> serve` listens with the flag and serves one
// loopback connection through a premade ring, printing `serve: ok` or what
// went wrong; any other operation goes to `sb_probe` (probe.c). Exit 2 from
// `serve` says the kernel refused rings; tests/run.js runs `serve` only once
// the unconfined probe made a ring, so there it fails the check.
//
// `<exe> fallback` listens with the flag where no ring can be had and accepts
// one loopback connection: exit 0 when the connection is a descriptor and
// `netRingState()` is negative, 1 otherwise. `<exe> freed <ring>` opens a ring
// listener and closes it, which frees premade ring 0, then runs probe.c's
// `freed-dup` on the inherited ring `<ring>` (NURING-36).
import {
  NET_LISTEN_RING,
  connectResult,
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  netRingState,
  netWrite,
  pollAdd,
  pollCreate,
  pollWait,
  tcpAccept,
  tcpConnect,
  tcpListenFlags,
} from "nish:net"

declare function sb_probe(op: string, path: string): i32

/** The lowest slot handle; every handle below it is a descriptor. */
const SLOT_BASE: i32 = 1048576

/** Waits up to five seconds for `fd` to be ready for `events`, and answers whether it was. */
const waitFor = (fd: i32, events: i32): boolean => {
  const loop: i32 = pollCreate()
  pollAdd(loop, fd, events, fd)
  const ready: i32[] = new Array<i32>(8)
  const n: i32 = pollWait(loop, ready, 5000)
  netClose(loop)
  return n > 0
}

/** Listens with `NET_LISTEN_RING`, serves one loopback echo through a ring slot, and answers the exit status. */
const serve = (): i32 => {
  const listener: i32 = tcpListenFlags("127.0.0.1", 0, 16, NET_LISTEN_RING)
  if (listener < 0) {
    console.log(`serve: tcpListenFlags answered ${listener}`)
    return 1
  }
  const state: i32 = netRingState()
  if (state !== 1) {
    console.log(`serve: rings refused: ${state}`)
    return 2
  }
  const addr: u8[] = new Array<u8>(18)
  if (netAddress(addr, "127.0.0.1", netLocalPort(listener)) < 0) {
    console.log("serve: netAddress failed")
    return 1
  }
  const client: i32 = tcpConnect(addr)
  if (client < 0 || !waitFor(client, 2) || connectResult(client) !== 0) {
    console.log(`serve: the connection failed: ${client}`)
    return 1
  }
  const peer: u8[] = new Array<u8>(18)
  let conn: i32 = -11
  let tries: i32 = 0
  while (conn === -11 && tries < 50) {
    waitFor(listener, 1)
    conn = tcpAccept(listener, peer)
    tries += 1
  }
  if (conn < SLOT_BASE) {
    console.log(`serve: tcpAccept answered ${conn}, not a slot handle`)
    return 1
  }
  const ping: u8[] = [112, 105, 110, 103]
  const buf: u8[] = new Array<u8>(8)
  if (netWrite(client, ping, 0, 4) !== 4) {
    console.log("serve: the client's write failed")
    return 1
  }
  let got: i32 = -11
  tries = 0
  while (got === -11 && tries < 50) {
    waitFor(conn, 1)
    got = netRead(conn, buf, 0, 8)
    tries += 1
  }
  if (got !== 4 || netWrite(conn, buf, 0, 4) !== 4) {
    console.log(`serve: the slot read ${got} bytes and did not echo them`)
    return 1
  }
  got = -11
  tries = 0
  while (got === -11 && tries < 50) {
    waitFor(client, 1)
    got = netRead(client, buf, 0, 8)
    tries += 1
  }
  if (got !== 4 || buf[0] !== 112 || buf[3] !== 103) {
    console.log(`serve: the client read back ${got} bytes`)
    return 1
  }
  netClose(conn)
  netClose(client)
  netClose(listener)
  console.log("serve: ok")
  return 0
}

/** Listens with `NET_LISTEN_RING` where rings are refused, accepts one loopback connection, and answers the exit status. */
const fallback = (): i32 => {
  const listener: i32 = tcpListenFlags("127.0.0.1", 0, 16, NET_LISTEN_RING)
  if (listener < 0) {
    console.log(`fallback: tcpListenFlags answered ${listener}`)
    return 1
  }
  const addr: u8[] = new Array<u8>(18)
  if (netAddress(addr, "127.0.0.1", netLocalPort(listener)) < 0) {
    console.log("fallback: netAddress failed")
    return 1
  }
  const client: i32 = tcpConnect(addr)
  if (client < 0 || !waitFor(client, 2) || connectResult(client) !== 0) {
    console.log(`fallback: the connection failed: ${client}`)
    return 1
  }
  const peer: u8[] = new Array<u8>(18)
  let conn: i32 = -11
  let tries: i32 = 0
  while (conn === -11 && tries < 50) {
    waitFor(listener, 1)
    conn = tcpAccept(listener, peer)
    tries += 1
  }
  const state: i32 = netRingState()
  if (conn < 0 || conn >= SLOT_BASE || state >= 0) {
    console.log(`fallback: tcpAccept answered ${conn} and netRingState() ${state}`)
    return 1
  }
  netClose(conn)
  netClose(client)
  netClose(listener)
  console.log(`fallback: a descriptor, netRingState() ${state}`)
  return 0
}

/** Opens a ring listener and closes it, freeing its premade ring, then probes `ring`'s duplicate. */
const freed = (ring: string): i32 => {
  const listener: i32 = tcpListenFlags("127.0.0.1", 0, 16, NET_LISTEN_RING)
  const state: i32 = netRingState()
  if (listener < 0 || state !== 1) {
    console.log(`freed: tcpListenFlags answered ${listener} and netRingState() ${state}`)
    return 1
  }
  netClose(listener)
  return sb_probe("freed-dup", ring)
}

export const main = (): i32 => {
  const args = process.argv
  if (args[1] === "serve") return serve()
  if (args[1] === "fallback") return fallback()
  if (args[1] === "freed") return freed(args.length > 2 ? args[2] : "")
  return sb_probe(args[1], args.length > 2 ? args[2] : "")
}
