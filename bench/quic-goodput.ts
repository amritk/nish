// QUIC goodput, NewReno against CUBIC, through a userspace delay and loss
// shim on a virtual clock. A `nish/net/quic` server connection sends one
// stream to the `net_quic_conn` test client across a modelled path: a
// 20 Mbit/s bottleneck with a drop-tail queue of one bandwidth-delay
// product, 25 ms each way (a 50 ms RTT, so a BDP of 125,000 bytes), and 1%
// of datagrams lost at random each way from a seeded generator. The client
// acknowledges every second datagram, or 25 ms after the first it has not
// acknowledged, as RFC 9000 §13.2.1 lets a receiver.
//
// Nothing here reads a wall clock: a run is a pure function of its seed, the
// controller and the size, so the spread across seeds (which datagrams the
// shim drops) is the noise band. Every seed runs both controllers, NewReno
// first then CUBIC, before the next seed: the repetitions interleave.
//
//   build/nish bench/quic-goodput.ts --link build/quic-goodput && build/quic-goodput
//
// Prints a line per run and, per size and controller, the median goodput in
// kbit/s with its quartiles and range, and on how many seeds CUBIC finished
// first. The figures and the default they chose: docs/security/quic.md
// ("Congestion control").
import { quicEncodeTransportParameters } from "nish/net/quic-conn-params"
import { QUIC_RECOVERY_CUBIC, QUIC_RECOVERY_NEWRENO } from "nish/net/quic-recovery"
import { QuicConnection } from "nish/net/quic"
import { TLS_AES_128_GCM_SHA256 } from "nish/net/tls/schedule"
import { fromHex } from "../tests/link/crypto_x509/hex"
import {
  CLIENT_SCID,
  QcClient,
  qcConnect,
  qcExchange,
  qcHello,
  qcParams,
  qcPushAppAck,
  qcReceive,
  qcShort,
} from "../tests/link/net_quic_conn/client"
import { qcConfig } from "../tests/link/net_quic_conn/common"
import { qcStream } from "../tests/link/net_quic_conn/data"
import { fixedEntropy } from "../tests/link/net_quic_conn_replay/server"

/** One-way delay, in microseconds. */
const DELAY: i64 = 25000
/** The bottleneck's time per byte, in nanoseconds: 20 Mbit/s is 400 ns a byte. */
const NS_PER_BYTE: i64 = 400
/** The bottleneck queue, in bytes: one BDP, 20 Mbit/s over 50 ms. */
const QUEUE: i64 = 125000
/** Loss per datagram, in units of 1/10000: 1%. */
const LOSS: i64 = 100
/** The client's acknowledgement delay, in microseconds (the RFC 9000 default `max_ack_delay`). */
const ACK_DELAY: i64 = 25000
/** Give up on a run after this much virtual time, in microseconds. */
const LIMIT: i64 = 600000000
/** The stream's send buffer, `QUIC_CONN_MAX_STREAM_DATA`. */
const BUFFER: i64 = 1048576
/** Credit the client gives the server, for the connection and the stream. */
const CREDIT: i64 = 67108864

/** Datagrams on their way one direction, in arrival order. */
class Pipe {
  at: i64[]
  data: u8[][]
  head: i32 = 0

  constructor() {
    this.at = []
    this.data = []
  }

  /** The arrival time of the next datagram, or -1 when none is on its way. */
  next(): i64 {
    return this.head < toI32(this.at.length) ? this.at[this.head] : -1
  }
}

/** The path's state: the clock, the bottleneck's queue and the loss generator. */
class Shim {
  now: i64 = 0
  /** When the bottleneck finishes sending what it holds. */
  linkFree: i64 = 0
  rng: i64 = 0
  toClient: Pipe
  toServer: Pipe
  dropped: i32 = 0
  overflowed: i32 = 0

  constructor(seed: i64) {
    this.rng = seed
    this.toClient = new Pipe()
    this.toServer = new Pipe()
  }

  /** Whether the next datagram is lost: a 31-bit LCG (glibc's constants) below `LOSS` in 10,000. */
  lost(): boolean {
    this.rng = (this.rng * 1103515245 + 12345) % 2147483648
    return (this.rng >> 8) % 10000 < LOSS
  }

  /** Puts a server datagram through the bottleneck: a full queue or the dice drop it. */
  toward(d: u8[]): void {
    const start: i64 = this.linkFree > this.now ? this.linkFree : this.now
    if (((start - this.now) * 1000) / NS_PER_BYTE > QUEUE) {
      this.overflowed = this.overflowed + 1
      return
    }
    this.linkFree = start + (toI64(toI32(d.length)) * NS_PER_BYTE) / 1000
    if (this.lost()) {
      this.dropped = this.dropped + 1
      return
    }
    this.toClient.at.push(this.linkFree + DELAY)
    this.toClient.data.push(d)
  }

  /** Sends a client datagram back: no bottleneck, the same delay and the same dice. */
  back(d: u8[]): void {
    if (this.lost()) {
      return
    }
    this.toServer.at.push(this.now + DELAY)
    this.toServer.data.push(d)
  }
}

/** The earlier of two times, either of which may be -1 for none. */
const sooner = (a: i64, b: i64): i64 => {
  if (a < 0) {
    return b
  }
  return b < 0 || b > a ? a : b
}

/** Sends the client's ACK of everything it has received. */
const ack = (shim: Shim, c: QcClient): void => {
  const frame: u8[] = []
  qcPushAppAck(frame, c)
  if (toI32(frame.length) > 0) {
    shim.back(qcShort(c, frame))
  }
}

/**
 * Sends `total` bytes on one stream under `controller` through a shim seeded
 * with `seed`. Answers the microseconds from the first byte written to the
 * last acknowledged, or -1 when it did not finish.
 */
const transfer = (controller: i32, seed: i64, total: i64): i64 => {
  // The send buffer is `maxStreamData`, at most 1 MiB: eight BDPs, more than
  // either controller's window reaches at this loss rate.
  const config = qcConfig(CREDIT, total < BUFFER ? total : BUFFER, toI64(1), toI64(4))
  config.congestion = controller
  const conn = new QuicConnection(config, fixedEntropy())
  const scid: u8[] = fromHex(CLIENT_SCID)
  const c = new QcClient(TLS_AES_128_GCM_SHA256, scid)
  const params = qcParams(scid, CREDIT)
  params.initialMaxData = CREDIT
  if (
    !qcConnect(conn, c, qcHello([TLS_AES_128_GCM_SHA256], "nish-echo", quicEncodeTransportParameters(params)))
  ) {
    return -1
  }
  qcExchange(conn, c, qcShort(c, qcStream(toI64(0), toI64(0), "get", false)))
  const shim = new Shim(seed)
  const start: i64 = c.now * 1000
  shim.now = start
  const chunk: u8[] = []
  for (let k: i32 = 0; k < 16384; k++) {
    chunk.push(toU8(k & 255))
  }
  let written: i64 = 0
  let unacked: i32 = 0
  let ackDue: i64 = -1
  while (shim.now - start < LIMIT) {
    const ms: i64 = shim.now / 1000
    while (written < total) {
      const n: i64 = total - written < toI64(16384) ? total - written : toI64(16384)
      const piece: u8[] = n === toI64(16384) ? chunk : chunk.slice(0, toI32(n))
      if (conn.writeStream(toI64(0), piece, written + n === total) !== 0) {
        break
      }
      written += n
    }
    let d: u8[] | null = conn.takeDatagram(ms)
    while (d !== null) {
      shim.toward(d)
      d = conn.takeDatagram(ms)
    }
    const stream = conn.streams.find(toI64(0))
    if (stream === null || conn.closed()) {
      return -1
    }
    if (stream.sendBase >= total) {
      return shim.now - start
    }
    // The next event: an arrival either way, the client's ACK timer, or the
    // server's timer, run at the end of its millisecond.
    const deadline: i64 = conn.deadline()
    let next: i64 = sooner(shim.toClient.next(), shim.toServer.next())
    next = sooner(next, ackDue)
    next = sooner(next, deadline >= 0 ? deadline * 1000 + 999 : -1)
    if (next < 0) {
      return -1
    }
    if (next > shim.now) {
      shim.now = next
    }
    const at: i64 = shim.now / 1000
    while (shim.toClient.next() >= 0 && shim.toClient.next() <= shim.now) {
      const p: Pipe = shim.toClient
      c.now = at
      qcReceive(c, p.data[p.head])
      p.data[p.head] = []
      p.head = p.head + 1
      unacked++
      if (unacked >= 2) {
        ack(shim, c)
        unacked = 0
        ackDue = -1
      } else if (ackDue < 0) {
        ackDue = shim.now + ACK_DELAY
      }
    }
    if (ackDue >= 0 && ackDue <= shim.now) {
      ack(shim, c)
      unacked = 0
      ackDue = -1
    }
    c.appPayloads = []
    while (shim.toServer.next() >= 0 && shim.toServer.next() <= shim.now) {
      const p: Pipe = shim.toServer
      const dg: u8[] = p.data[p.head]
      conn.receiveWindowFrom(dg, 0, toI32(dg.length), c.address, at)
      p.data[p.head] = []
      p.head = p.head + 1
    }
    const due: i64 = conn.deadline()
    if (due >= 0 && due * 1000 + 999 <= shim.now) {
      conn.handleTimer(at)
    }
  }
  return -1
}

/** `values` sorted, ascending. */
const sorted = (values: i64[]): i64[] => {
  const out: i64[] = values.slice(0, toI32(values.length))
  for (let i: i32 = 1; i < toI32(out.length); i++) {
    const v: i64 = out[i]
    let j: i32 = i - 1
    while (j >= 0 && out[j] > v) {
      out[j + 1] = out[j]
      j--
    }
    out[j + 1] = v
  }
  return out
}

/** A summary line: the median goodput and the range, in kbit/s. */
const summary = (name: string, total: i64, rates: i64[]): string => {
  const s: i64[] = sorted(rates)
  const n: i32 = toI32(s.length)
  if (n === 0) {
    return `${name} ${total}: no runs`
  }
  return `${name} ${total} bytes: median ${s[n / 2]} kbit/s, quartiles ${s[n / 4]}..${s[(n * 3) / 4]}, range ${s[0]}..${s[n - 1]}, ${n} seeds`
}

export const main = (): i32 => {
  const runs: i32 = 41
  // One BDP, and 32 of them.
  const sizes: i64[] = [125000, 4000000]
  for (let z: i32 = 0; z < toI32(sizes.length); z++) {
    const total: i64 = sizes[z]
    const reno: i64[] = []
    const cubic: i64[] = []
    let wins: i32 = 0
    for (let r: i32 = 0; r < runs; r++) {
      const seed: i64 = toI64(r * 7919 + 17)
      const a: i64 = transfer(QUIC_RECOVERY_NEWRENO, seed, total)
      const b: i64 = transfer(QUIC_RECOVERY_CUBIC, seed, total)
      if (a <= 0 || b <= 0) {
        console.log(`seed ${seed} size ${total}: a run did not finish (${a} ${b})`)
        return 1
      }
      reno.push((total * 8000) / a)
      cubic.push((total * 8000) / b)
      if (b < a) {
        wins++
      }
      console.log(
        `seed ${seed} size ${total}: newreno ${(total * 8000) / a} kbit/s, cubic ${(total * 8000) / b} kbit/s`
      )
    }
    console.log(summary("newreno", total, reno))
    console.log(summary("cubic", total, cubic))
    console.log(`cubic finished first on ${wins} of ${runs} seeds`)
  }
  return 0
}
