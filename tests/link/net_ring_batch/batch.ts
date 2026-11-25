// `pollWaitBatch` on a `NET_LISTEN_RING` listener (NURING-45). The program is
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
// With `apart`: the ring listener is in no loop, and a second loop holds only
// a UDP socket with one datagram due. A wait for 8 with a `maxWaitMs` of
// 3,000 on that loop must answer the datagram at once: no ring source has
// joined the loop, so it has no batch to wait for.
//
// With `reuse`: the loop holds the listener and `signalFd()`, and one wait
// arms the ring's poll on the signal descriptor. `netClose` closes it, a UDP
// socket takes its number, and a datagram sent to it must be reported by the
// next `pollWait`, though the ring's poll is still armed on the old pipe.
// `reusefile` is the same with `fileClose` closing the signal descriptor:
// either closer frees the number, so either must end the direct wait's
// watch on it.
//
// With `trickle`: a child (this program, `trickler <port>`) connects 16
// clients, and once they are accepted writes one byte on each, 10 ms apart.
// One wait for 16 with a `maxWaitMs` of 400 must take all 16. tests/run.js
// runs it with NISH_URING_STATS=1: the program raises SIGUSR1 on itself
// before and after the wait, and the two `signal` lines' `enters` and
// `window_waits` show how often the window entered the ring and pumped. A
// window that waits on the ring wakes once per byte; one that sleeps in
// slices pumps at most eight times.
//
// With `unfilled`: the same, but the trickler writes one byte, so the window
// for 16 is never filled and sleeps its whole `maxWaitMs` of 400 out: the
// stats lines must show it slept in 6 to 8 slices, not one and not 16.
//
// Exit 0 is a pass, 2 says the kernel refused rings (the section's skip), 5
// that the UDP socket did not take the closed number (`reuse`'s skip), and 1
// is a failure, with its line.
import { fileClose, realpathSync } from "nish:fs"
import {
  NET_LISTEN_RING,
  netAddress,
  netClose,
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
  udpBind,
  udpSendTo,
} from "nish:net"
import { kill, monotonicNanos, readSignal, signalFd, spawn, waitPid } from "nish:process"

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

/**
 * The `trickler` mode: connect `CLIENTS` clients to `port`, then, after
 * 300 ms, write one byte on each of the first `bytes`, 10 ms apart, and hold
 * them for 2 s.
 * @param port the listener's port
 * @param bytes how many clients write a byte
 * @returns the exit status
 */
const trickler = (port: i32, bytes: i32): i32 => {
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", port)
  const clients: i32[] = new Array<i32>(CLIENTS)
  for (let i: i32 = 0; i < CLIENTS; i++) {
    clients[i] = tcpConnect(addr)
    if (clients[i] < 0) {
      return 1
    }
  }
  const idle: i32 = pollCreate()
  const ready: i32[] = new Array<i32>(2)
  pollWait(idle, ready, 300)
  const one: u8[] = [120]
  for (let i: i32 = 0; i < bytes; i++) {
    if (netWrite(clients[i], one, 0, 1) !== 1) {
      return 1
    }
    pollWait(idle, ready, 10)
  }
  pollWait(idle, ready, 2000)
  return 0
}

/**
 * Ask for the stats lines: `kill` takes only 0, 2, 9 and 15, so the system's
 * `kill` sends SIGUSR1, and the next pump of the loop prints them.
 * @param me this process's pid
 * @returns false when `kill -USR1` did not run or failed
 */
const askStats = (me: i32): boolean => {
  const pid: i32 = spawn(["kill", "-USR1", `${me}`])
  if (pid <= 0) {
    return false
  }
  const status: i32[] = waitPid(pid, 0)
  return status[0] === pid && status[1] === 0
}

/**
 * The `trickle` and `unfilled` modes: one batch window for 16 while `bytes`
 * bytes trickle in.
 * @param loop the loop, holding the listener
 * @param listener the ring listener
 * @param bytes how many of the trickler's clients write a byte
 * @returns the exit status
 */
const trickle = (loop: i32, listener: i32, bytes: i32): i32 => {
  const pid: string | null = realpathSync("/proc/self")
  const self: string | null = realpathSync("/proc/self/exe")
  if (pid === null || self === null) {
    console.log("/proc/self could not be read")
    return 1
  }
  const me: i32 = parseInt(pid.substring(6))
  if (spawn([self, "trickler", `${netLocalPort(listener)}`, `${bytes}`]) <= 0) {
    console.log("the trickler did not start")
    return 1
  }
  const ready: i32[] = new Array<i32>(128)
  const peer: u8[] = new Array<u8>(18)
  const buf: u8[] = new Array<u8>(64)
  let accepted: i32 = 0
  while (accepted < CLIENTS) {
    const n: i32 = pollWait(loop, ready, 2000)
    if (n <= 0) {
      console.log(`a wait for the trickler's clients answered ${n} with ${accepted} accepted`)
      return 1
    }
    let h: i32 = tcpAccept(listener, peer)
    while (h >= 0) {
      accepted += 1
      pollAdd(loop, h, 1, h)
      h = tcpAccept(listener, peer)
    }
  }
  // The `signal` line before the window: the next pump prints it.
  if (!askStats(me)) {
    console.log("kill -USR1 did not run")
    return 1
  }
  if (pollWait(loop, ready, 0) !== 0) {
    console.log("a byte came before the window")
    return 1
  }
  // The first byte opens the window; the other 15 come within 160 ms of it.
  const t0: i64 = monotonicNanos()
  const n: i32 = pollWaitBatch(loop, ready, 2000, CLIENTS, 400)
  const took: i64 = since(t0)
  const read: i32 = take(ready, n, buf)
  const asked: boolean = askStats(me)
  pollWait(loop, ready, 0)
  if (!asked) {
    console.log("kill -USR1 did not run after the window")
    return 1
  }
  if (bytes < CLIENTS) {
    if (n !== bytes || read !== bytes || took < 350) {
      console.log(`a wait for 16 with ${bytes} bytes sent answered ${n} pairs and ${read} bytes in ${took} ms`)
      return 1
    }
    console.log(`unfilled: one wait for 16 took ${bytes} byte and slept out its 400 ms, in ${took} ms`)
    return 0
  }
  if (n !== CLIENTS || read !== CLIENTS) {
    console.log(`a wait for 16 with 16 bytes trickling in answered ${n} pairs and ${read} bytes`)
    return 1
  }
  console.log(`trickle: one wait for 16 took 16 bytes that came 10 ms apart, in ${took} ms`)
  return 0
}

/** The token a UDP socket is reported under. */
const DATAGRAM: i32 = -3

/**
 * Bind a UDP receiver and send it one datagram from a second socket.
 * @param receiver the bound receiver
 * @returns false when the datagram was not sent
 */
const datagram = (receiver: i32): boolean => {
  const sender: i32 = udpBind("127.0.0.1", 0, 0)
  const to: u8[] = new Array<u8>(18)
  netAddress(to, "127.0.0.1", netLocalPort(receiver))
  const one: u8[] = [120]
  return sender >= 0 && udpSendTo(sender, one, 0, 1, to, 0, 0) === 1
}

/**
 * The `apart` mode: a batch on a loop no ring source has joined.
 * @returns the exit status
 */
const apart = (): i32 => {
  const other: i32 = pollCreate()
  const receiver: i32 = udpBind("127.0.0.1", 0, 0)
  if (receiver < 0 || pollAdd(other, receiver, 1, DATAGRAM) !== 0 || !datagram(receiver)) {
    console.log("the UDP pair did not start")
    return 1
  }
  const ready: i32[] = new Array<i32>(16)
  const t0: i64 = monotonicNanos()
  const n: i32 = pollWaitBatch(other, ready, 2000, 8, 3000)
  const took: i64 = since(t0)
  if (n !== 1 || ready[0] !== DATAGRAM || took >= 1500) {
    console.log(`a wait for 8 on a loop with no ring source answered ${n} after ${took} ms`)
    return 1
  }
  console.log(`apart: a wait for 8 on a loop with no ring source answered 1 after ${took} ms`)
  return 0
}

/**
 * The `reuse` and `reusefile` modes: a socket takes a closed `signalFd()`'s
 * number.
 * @param loop the loop, holding the listener
 * @param viaFile whether `fileClose` closes the signal descriptor, not `netClose`
 * @returns the exit status
 */
const reuse = (loop: i32, viaFile: boolean): i32 => {
  const sig: i32 = signalFd()
  pollAdd(loop, sig, 1, SIGNAL)
  const ready: i32[] = new Array<i32>(16)
  pollWait(loop, ready, 20)
  if (viaFile) {
    fileClose(sig)
  } else {
    netClose(sig)
  }
  const receiver: i32 = udpBind("127.0.0.1", 0, 0)
  if (receiver !== sig) {
    console.log(`the UDP socket took ${receiver}, not ${sig}`)
    return 5
  }
  if (pollAdd(loop, receiver, 1, DATAGRAM) !== 0 || !datagram(receiver)) {
    console.log("the UDP pair did not start")
    return 1
  }
  const t0: i64 = monotonicNanos()
  const n: i32 = pollWait(loop, ready, 2000)
  const took: i64 = since(t0)
  if (n !== 1 || ready[0] !== DATAGRAM || took >= 1000) {
    console.log(`a wait on the reused number answered ${n} after ${took} ms`)
    return 1
  }
  const how: string = viaFile ? "fileClose" : "netClose"
  console.log(`reuse: a socket on the signal number ${how} closed was reported after ${took} ms`)
  return 0
}

export const main = (): i32 => {
  const args: string[] = process.argv
  const mode: string = args.length > 1 ? args[1] : "batch"
  if (mode === "killer") {
    return killer(args.length > 2 ? parseInt(args[2]) : 0)
  }
  if (mode === "trickler") {
    return trickler(args.length > 2 ? parseInt(args[2]) : 0, args.length > 3 ? parseInt(args[3]) : CLIENTS)
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
  if (mode === "apart") {
    return apart()
  }
  const loop: i32 = pollCreate()
  pollAdd(loop, listener, 1, LISTENER)
  if (mode === "reuse" || mode === "reusefile") {
    return reuse(loop, mode === "reusefile")
  }
  if (mode === "trickle" || mode === "unfilled") {
    return trickle(loop, listener, mode === "unfilled" ? 1 : CLIENTS)
  }
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

  // Sixteen bytes in: one wait for 16 answers them all, well before its
  // maxWaitMs of 1,000.
  if (!poke(clients, CLIENTS)) {
    console.log("a client's write did not take its byte")
    return 1
  }
  let t0: i64 = monotonicNanos()
  let n: i32 = pollWaitBatch(loop, ready, 2000, CLIENTS, 1000)
  let took: i64 = since(t0)
  if (n !== CLIENTS || take(ready, n, buf) !== CLIENTS || took >= 500) {
    console.log(`a wait for 16 with 16 bytes due answered ${n} after ${took} ms`)
    return 1
  }
  console.log("batch: one wait for 16 answered 16")

  // One byte in: the wait for 16 ends at its maxWaitMs, not its timeout.
  if (!poke(clients, 1)) {
    console.log("a client's write did not take its byte")
    return 1
  }
  t0 = monotonicNanos()
  n = pollWaitBatch(loop, ready, 2000, CLIENTS, 50)
  took = since(t0)
  if (n !== 1 || take(ready, n, buf) !== 1 || took < 40 || took >= 1000) {
    console.log(`a wait for 16 with one byte due answered ${n} after ${took} ms`)
    return 1
  }
  console.log("batch: a wait for 16 with one due answered 1 at its maxWaitMs")

  // Nothing in: the wait answers 0 at its timeout of 100 ms, with no second
  // wait of its maxWaitMs after it, which would take 150. An attempt the
  // scheduler stretches past 145 is tried again, up to 3 times.
  took = 1000
  for (let attempt: i32 = 0; attempt < 3 && took >= 145; attempt++) {
    t0 = monotonicNanos()
    n = pollWaitBatch(loop, ready, 100, 4, 50)
    took = since(t0)
    if (n !== 0 || took < 90) {
      console.log(`an idle wait for 4 answered ${n} after ${took} ms`)
      return 1
    }
  }
  if (took >= 145) {
    console.log(`an idle wait for 4 took ${took} ms, past its timeout of 100 three times`)
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
