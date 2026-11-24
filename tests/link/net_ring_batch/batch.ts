// `pollWaitBatch` on a `NET_LISTEN_RING` listener (NURING-40). The program is
// its own peer: it opens a ring listener, connects 16 clients to it with
// `tcpConnect`, accepts them, and then drives the batch wait.
//
// With no argument (`batch`): sixteen one-byte writes come back from one
// wait for 16; one write and a wait for 16 with a `maxWaitMs` of 50 answers
// the one event after that bound, not the 2,000 ms timeout; an idle wait for
// 4 answers 0 at its timeout; and a `ready` of 8 slots ends a wait for 16 at
// 4 pairs without waiting. tests/run.js's `net_ring` section runs this mode
// under `noepoll.c`, which makes every epoll wait answer EPERM: the loop holds
// only ring slots, so each wait sleeps on its ring directly, and a wait that
// reached epoll would fail the run.
//
// With `signal`: the loop also watches `signalFd()`. One client writes, and
// the program asks for 256 events with a `maxWaitMs` of 5,000 while a child
// (this program, `killer <pid>`) sends it SIGTERM 300 ms later. The signal
// must be reported well before the batch's bound.
//
// Exit 0 is a pass, 2 says the kernel refused rings (the section's skip),
// and 1 is a failure, with its line.
import { realpathSync } from "nish:fs"
import {
  NET_LISTEN_RING,
  netAddress,
  netLocalPort,
  netRead,
  netRingState,
  netWrite,
  pollAdd,
  pollCreate,
  pollWait,
  pollWaitBatch,
  tcpAccept,
  tcpConnect,
  tcpListenFlags,
} from "nish:net"
import { kill, monotonicNanos, readSignal, signalFd, spawn } from "nish:process"

/** The clients the program connects to itself. */
const CLIENTS: i32 = 16
/** The token the listener is reported under; a slot handle is never negative. */
const LISTENER: i32 = -1
/** The token `signalFd()` is reported under. */
const SIGNAL: i32 = -2

/** Milliseconds since `from`, a `monotonicNanos()` reading. */
const since = (from: i64): i64 => (monotonicNanos() - from) / 1000000

/**
 * Read a slot to -11, as a server does.
 * @param h the slot
 * @param buf where the bytes go
 * @returns the bytes read, or -1 when the read ends in anything but -11
 */
const drain = (h: i32, buf: u8[]): i32 => {
  let total: i32 = 0
  let got: i32 = netRead(h, buf, 0, toI32(buf.length))
  while (got > 0) {
    total += got
    got = netRead(h, buf, 0, toI32(buf.length))
  }
  return got === -11 ? total : -1
}

/**
 * Write one byte on each of the first `count` clients.
 * @param clients the client sockets
 * @param count how many write
 * @returns false when a write did not take its byte
 */
const poke = (clients: i32[], count: i32): boolean => {
  const one: u8[] = [120]
  for (let i: i32 = 0; i < count; i++) {
    if (netWrite(clients[i], one, 0, 1) !== 1) {
      return false
    }
  }
  return true
}

/**
 * Take every pair in `ready` that is a slot, reading it to -11.
 * @param ready the pairs a wait answered
 * @param n how many
 * @param buf where the bytes go
 * @returns the bytes read, or -1 for a read that failed or a token that is not a slot
 */
const take = (ready: i32[], n: i32, buf: u8[]): i32 => {
  let total: i32 = 0
  for (let k: i32 = 0; k < n; k++) {
    const token: i32 = ready[2 * k]
    if (token < 0) {
      return -1
    }
    const got: i32 = drain(token, buf)
    if (got < 0) {
      return -1
    }
    total += got
  }
  return total
}

/** The `killer` mode: wait 300 ms on an empty loop, then SIGTERM the pid. */
const killer = (pid: i32): i32 => {
  const loop: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(2)
  pollWait(loop, ready, 300)
  return kill(pid, 15) === 0 ? 0 : 1
}

export const main = (): i32 => {
  const args: string[] = process.argv
  const mode: string = args.length > 1 ? args[1] : "batch"
  if (mode === "killer") {
    return killer(args.length > 2 ? parseInt(args[2]) : 0)
  }
  const listener: i32 = tcpListenFlags("127.0.0.1", 0, 64, NET_LISTEN_RING)
  if (listener < 0) {
    console.log(`tcpListenFlags failed with ${listener}`)
    return 1
  }
  const state: i32 = netRingState()
  if (state !== 1) {
    console.log(`rings refused: ${state}`)
    return 2
  }
  const loop: i32 = pollCreate()
  pollAdd(loop, listener, 1, LISTENER)
  const sig: i32 = mode === "signal" ? signalFd() : -1
  if (mode === "signal") {
    pollAdd(loop, sig, 1, SIGNAL)
  }
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", netLocalPort(listener))
  const clients: i32[] = new Array<i32>(CLIENTS)
  for (let i: i32 = 0; i < CLIENTS; i++) {
    clients[i] = tcpConnect(addr)
    if (clients[i] < 0) {
      console.log(`tcpConnect answered ${clients[i]}`)
      return 1
    }
  }
  const ready: i32[] = new Array<i32>(128)
  const peer: u8[] = new Array<u8>(18)
  const buf: u8[] = new Array<u8>(64)
  let accepted: i32 = 0
  while (accepted < CLIENTS) {
    const n: i32 = pollWaitBatch(loop, ready, 2000, 1, 0)
    if (n <= 0) {
      console.log(`a wait for the clients answered ${n} with ${accepted} accepted`)
      return 1
    }
    for (let k: i32 = 0; k < n; k++) {
      if (ready[2 * k] === LISTENER) {
        let h: i32 = tcpAccept(listener, peer)
        while (h >= 0) {
          accepted += 1
          pollAdd(loop, h, 1, h)
          h = tcpAccept(listener, peer)
        }
      }
    }
  }

  if (mode === "signal") {
    const pid: string | null = realpathSync("/proc/self")
    const self: string | null = realpathSync("/proc/self/exe")
    if (pid === null || self === null) {
      console.log("/proc/self could not be read")
      return 1
    }
    if (!poke(clients, 1)) {
      console.log("a client's write did not take its byte")
      return 1
    }
    const started: i64 = monotonicNanos()
    if (spawn([self, "killer", pid.substring(6)]) <= 0) {
      console.log("the killer did not start")
      return 1
    }
    let waits: i32 = 0
    while (since(started) < 10000) {
      const n: i32 = pollWaitBatch(loop, ready, 10000, 256, 5000)
      waits += 1
      if (n < 0) {
        console.log(`a wait for 256 answered ${n}`)
        return 1
      }
      for (let k: i32 = 0; k < n; k++) {
        if (ready[2 * k] === SIGNAL) {
          const took: i64 = since(started)
          if (readSignal(sig) !== 15) {
            console.log("the signal read was not SIGTERM")
            return 1
          }
          console.log(`signal: SIGTERM ended a wait for 256 after ${took} ms, in ${waits} waits`)
          return took < 2500 ? 0 : 1
        } else if (ready[2 * k] >= 0 && drain(ready[2 * k], buf) < 0) {
          console.log("a slot's read failed")
          return 1
        }
      }
    }
    console.log("SIGTERM was not reported within 10 s")
    return 1
  }

  // Sixteen bytes in: one wait for 16 answers them all.
  if (!poke(clients, CLIENTS)) {
    console.log("a client's write did not take its byte")
    return 1
  }
  let n: i32 = pollWaitBatch(loop, ready, 2000, CLIENTS, 1000)
  if (n !== CLIENTS || take(ready, n, buf) !== CLIENTS) {
    console.log(`a wait for 16 with 16 bytes due answered ${n}`)
    return 1
  }
  console.log("batch: one wait for 16 answered 16")

  // One byte in: the wait for 16 ends at its maxWaitMs, not its timeout.
  if (!poke(clients, 1)) {
    console.log("a client's write did not take its byte")
    return 1
  }
  let t0: i64 = monotonicNanos()
  n = pollWaitBatch(loop, ready, 2000, CLIENTS, 50)
  let took: i64 = since(t0)
  if (n !== 1 || take(ready, n, buf) !== 1 || took < 40 || took >= 1000) {
    console.log(`a wait for 16 with one byte due answered ${n} after ${took} ms`)
    return 1
  }
  console.log("batch: a wait for 16 with one due answered 1 at its maxWaitMs")

  // Nothing in: the wait answers 0 at its timeout, with no second wait.
  t0 = monotonicNanos()
  n = pollWaitBatch(loop, ready, 100, 4, 50)
  took = since(t0)
  if (n !== 0 || took < 90 || took >= 1000) {
    console.log(`an idle wait for 4 answered ${n} after ${took} ms`)
    return 1
  }
  console.log("batch: an idle wait answered 0 at its timeout")

  // A ready of 8 slots holds 4 pairs: the wait for 16 ends there.
  const small: i32[] = new Array<i32>(8)
  if (!poke(clients, CLIENTS)) {
    console.log("a client's write did not take its byte")
    return 1
  }
  t0 = monotonicNanos()
  n = pollWaitBatch(loop, small, 2000, CLIENTS, 1000)
  took = since(t0)
  let read: i32 = take(small, n, buf)
  if (n !== 4 || read !== 4 || took >= 500) {
    console.log(`a wait for 16 into a ready of 8 answered ${n} after ${took} ms`)
    return 1
  }
  while (read < CLIENTS) {
    n = pollWait(loop, ready, 2000)
    const got: i32 = n > 0 ? take(ready, n, buf) : -1
    if (got < 0) {
      console.log(`the rest of the bytes did not come: ${read} of ${CLIENTS}`)
      return 1
    }
    read += got
  }
  console.log("batch: a ready of 8 capped a wait for 16 at 4")
  return 0
}
