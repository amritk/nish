// The program half of bench/ring-inplace (run.mjs): a JSON record goes from a
// producer process, through an `SpscRing` in a `nish/sync/shm` region, to an
// `Http1Connection` that answers a keep-alive request with it, and on to a
// reader process that drains the socket. Three processes on three cores:
//
//     bench <copy|inplace> <size> <n> <producer-cpu> <reader-cpu>
//
//   copy     the producer renders into a private buffer and `tryPush`es it;
//            the consumer `tryPop`s it into a buffer of its own and hands it
//            to `Http1Connection.write`, which copies it into the output
//   inplace  the producer renders into the window `reserve` lends and
//            `commit`s it; the consumer `peek`s it, hands the ring's own
//            bytes to `sendBody`, which sends them from there, and `release`s
//
// The consumer is the parent: it answers `n` requests, timing each from the
// request to the flush less any wait for the producer, and prints one line
// of `name value` pairs: the per-message p50, p99 and mean in nanoseconds,
// the wall time per message (the whole pipeline's, waits and all), and the
// bytes copied per message, counted here: `tryPush`, `tryPop` and `write` in
// copy mode; in place, what `sendBody` copied of what the socket did not
// take. The response head is written into the output in both modes and not
// counted. The reader's byte count must equal what the consumer sent.
// The producer and the reader are this program again, under
// `taskset -c <cpu>` when that is not -1; run.mjs pins the parent.
import { monotonicNanos, spawn, waitPid } from "nish:process"
import {
  netAddress,
  netClose,
  netLocalPort,
  netRead,
  pollAdd,
  pollCreate,
  pollWait,
  tcpConnect,
  tcpListen,
} from "nish:net"
import { JsonWriter } from "nish/json"
import {
  H1_AGAIN,
  H1_REQUEST,
  H1_WRITE,
  Http1Config,
  Http1Connection,
  Http1Server,
} from "nish/net/http1-server"
import { attachSpscRing, initSpscRing, RING_EMPTY, spscRingBytes, SpscRing } from "nish/sync/ring"
import { createRegion, openRegion, SEQ_CST, SharedRegion, unlinkRegion } from "nish/sync/shm"

/** The ring: 16 MB of records. */
const CAP: i32 = 16777216
/** Set by the producer once it has attached. */
const READY_AT: i32 = 0
/** The bytes the producer copied, which it stores before it exits. */
const PRODUCER_COPIED_AT: i32 = 8
/** The bytes the reader read, which it stores before it exits. */
const READ_AT: i32 = 16
const RING_AT: i32 = 64
/** The ring header, 256 bytes, then its data: `spscRingBytes(CAP)`, which `main` checks. */
const BYTES: i32 = RING_AT + 256 + CAP
/** Per-message times in 10 ns buckets up to 200 µs; a longer one counts in the last. */
const BUCKETS: i32 = 20001
const PINNED_MS: i64 = 1792138314000
const POLL_IN: i32 = 1

const ascii = (text: string): u8[] => {
  const out: u8[] = []
  for (let k: i32 = 0; k < toI32(text.length); k++) {
    out.push(toU8(text.charCodeAt(k)))
  }
  return out
}

/**
 * Record `id` as a JSON object of at most `size` bytes into `w`'s buffer:
 * an order with as many line items as fit, each a small object of numbers
 * and strings, the way a service renders a response. Answers its length.
 */
const render = (w: JsonWriter, id: i32, size: i32): i32 => {
  w.beginObject()
  w.key("id")
  w.i32(id)
  w.key("status")
  w.string("shipped")
  w.key("items")
  w.beginArray()
  let k: i32 = 0
  // One item is at most 80 bytes; the closers take 2.
  while (w.end + 82 <= size) {
    w.beginObject()
    w.key("sku")
    w.i32(id * 31 + k)
    w.key("name")
    w.string("widget, blue")
    w.key("qty")
    w.i32((k & 7) + 1)
    w.key("cents")
    w.i32(1999 + k)
    w.endObject()
    k = k + 1
  }
  w.endArray()
  w.endObject()
  if (!w.complete()) {
    panic(`bench/ring-inplace: record ${id} did not render: ${w.failed}`)
  }
  return w.end
}

const producer = (region: SharedRegion, mode: string, size: i32, n: i32): i32 => {
  const ring: SpscRing = attachSpscRing(region, RING_AT).expect("attach")
  const own: u8[] = new Array<u8>(size)
  const w = new JsonWriter(own, 0)
  let copied: i64 = toI64(0)
  region.storeI32(READY_AT, 1, SEQ_CST)
  for (let i: i32 = 0; i < n; i++) {
    if (mode === "copy") {
      w.reset(own, 0)
      const len: i32 = render(w, i, size)
      while (!ring.tryPush(own, 0, len)) {
        // full: spin until the consumer takes one
      }
      copied = copied + toI64(len)
    } else {
      let win: u8[] = ring.reserve(size)
      while (win.length === 0) {
        win = ring.reserve(size)
      }
      w.reset(win, 0)
      ring.commit(render(w, i, size))
    }
  }
  region.storeI64(PRODUCER_COPIED_AT, copied, SEQ_CST)
  return 0
}

/** Waits up to five seconds for `fd` to be readable; whether it is. */
const readable = (fd: i32): boolean => {
  const loop: i32 = pollCreate()
  pollAdd(loop, fd, POLL_IN, 0)
  const out: i32[] = new Array<i32>(2)
  const n: i32 = pollWait(loop, out, 5000)
  netClose(loop)
  return n === 1
}

const reader = (region: SharedRegion, port: i32): i32 => {
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", port)
  const fd: i32 = tcpConnect(addr)
  const buf: u8[] = new Array<u8>(262144)
  let total: i64 = toI64(0)
  while (true) {
    const got: i32 = netRead(fd, buf, 0, toI32(buf.length))
    if (got > 0) {
      total = total + toI64(got)
    } else if (got === 0) {
      break
    } else if (got !== H1_AGAIN) {
      console.log(`reader: netRead answered ${got}`)
      break
    }
    // -11: spin, the reader has a core of its own
  }
  netClose(fd)
  region.storeI64(READ_AT, total, SEQ_CST)
  return 0
}

/** The bucket, in ns, below which `pct` percent of `n` messages fell. */
const percentile = (hist: i32[], n: i32, pct: i32): i32 => {
  const want: i64 = (toI64(n) * toI64(pct) + toI64(99)) / toI64(100)
  let seen: i64 = toI64(0)
  for (let k: i32 = 0; k < toI32(hist.length); k++) {
    seen = seen + toI64(hist[k])
    if (seen >= want) {
      return k * 10
    }
  }
  return (BUCKETS - 1) * 10
}

const child = (cpu: string, role: string, rest: string[]): i32 => {
  const argv: string[] = cpu === "-1" ? [] : ["taskset", "-c", cpu]
  argv.push(process.argv[0])
  argv.push(role)
  for (const a of rest) {
    argv.push(a)
  }
  return spawn(argv)
}

/** Sends what the connection holds until it holds nothing. */
const drain = (server: Http1Server, conn: Http1Connection): void => {
  server.flush(0)
  while (conn.wantsWrite()) {
    server.flush(0)
  }
}

const consumer = (
  region: SharedRegion,
  name: string,
  mode: string,
  size: i32,
  n: i32,
  pcpu: string,
  rcpu: string
): i32 => {
  const ring: SpscRing = initSpscRing(region, RING_AT, CAP, false)
  const listener: i32 = tcpListen("127.0.0.1", 0, 4)
  const server = new Http1Server(new Http1Config(), listener, 1)
  server.date.pin(PINNED_MS)
  const prod: i32 = child(pcpu, "producer", [name, mode, `${size}`, `${n}`])
  const read: i32 = child(rcpu, "reader", [name, `${netLocalPort(listener)}`])
  if (prod <= 0 || read <= 0) {
    console.log(`cannot start the children: ${prod} ${read}`)
    return 1
  }
  if (!readable(listener) || server.accept() !== 0) {
    console.log("the reader did not connect")
    return 1
  }
  while (region.loadI32(READY_AT, SEQ_CST) === 0) {
    // spin until the producer has attached
  }
  const conn: Http1Connection = server.connection(0)
  const request: u8[] = ascii("GET /orders HTTP/1.1\r\nHost: bench\r\n\r\n")
  const names: u8[][] = [ascii("content-type")]
  const values: u8[][] = [ascii("application/json")]
  const own: u8[] = new Array<u8>(size)
  const hist: i32[] = new Array<i32>(BUCKETS)
  const warm: i32 = n / 10
  let sum: i64 = toI64(0)
  let copied: i64 = toI64(0)
  let sent: i64 = toI64(0)
  let bodies: i64 = toI64(0)
  let waited: i64 = toI64(0)
  const start: i64 = monotonicNanos()
  for (let i: i32 = 0; i < n; i++) {
    const t0: i64 = monotonicNanos()
    conn.feed(request, 0, toI32(request.length))
    let e: i32 = server.next(0)
    while (e !== H1_REQUEST) {
      if (e < 0 || e === 0) {
        panic(`bench/ring-inplace: request ${i} answered event ${e}`)
      }
      e = server.next(0)
    }
    // The record. A wait for the producer is not the consumer's cost: the
    // time from the first attempt to the start of the one that found it
    // comes off the message's time. In place, every record is one `commit`
    // made, which never wraps, so `peek` lends each one and spinning on it
    // is waiting; a record `peek` cannot lend (one `tryPush` wrapped) would
    // be `tryPop`'s, copied and counted.
    let body: readonly u8[] = own
    let len: i32 = RING_EMPTY
    let lent: boolean = false
    let tried: i64 = monotonicNanos()
    const first: i64 = tried
    while (len === RING_EMPTY) {
      tried = monotonicNanos()
      if (mode === "inplace") {
        const r: readonly u8[] = ring.peek()
        if (r.length > 0) {
          body = r
          len = toI32(r.length)
          lent = true
        }
      } else {
        len = ring.tryPop(own, 0)
        if (len >= 0) {
          copied = copied + toI64(len)
        }
      }
    }
    waited = waited + (tried - first)
    // The head is what respond adds: the output may still hold the last
    // message's tail.
    const queued: i32 = conn.outputEnd - conn.outputStart
    if (conn.respond(200, names, values, len) !== 0) {
      panic(`bench/ring-inplace: respond answered short on ${i}`)
    }
    sent = sent + toI64(conn.outputEnd - conn.outputStart - queued)
    bodies = bodies + toI64(len)
    let off: i32 = 0
    while (off < len) {
      const took: i32 =
        mode === "copy" ? conn.write(own, off, len - off) : conn.sendBody(body, off, len - off)
      if (took > 0) {
        if (mode === "copy") {
          copied = copied + toI64(took)
        } else {
          // What sendBody copied: all it took when the socket took none of
          // the body, otherwise what is left in the output.
          const left: i32 = conn.outputEnd - conn.outputStart
          copied = copied + toI64(left < took ? left : took)
        }
        off = off + took
      } else if (took !== H1_AGAIN) {
        panic(`bench/ring-inplace: the body answered ${took} on ${i}`)
      }
      if (off < len) {
        // Short: send what is queued until the connection asks for more.
        drain(server, conn)
        while (server.next(0) !== H1_WRITE) {
          drain(server, conn)
        }
      }
    }
    if (lent) {
      ring.release()
    }
    conn.end()
    server.flush(0)
    if (i >= warm) {
      const d: i64 = monotonicNanos() - t0 - (tried - first)
      sum = sum + d
      const k: i32 = d >= toI64(BUCKETS - 1) * toI64(10) ? BUCKETS - 1 : toI32(d / toI64(10))
      if (k >= 0 && k < toI32(hist.length)) {
        hist[k] = hist[k] + 1
      }
    }
  }
  drain(server, conn)
  const wall: i64 = monotonicNanos() - start
  server.close(0)
  netClose(listener)
  waitPid(prod, 0)
  waitPid(read, 0)
  copied = copied + region.loadI64(PRODUCER_COPIED_AT, SEQ_CST)
  const heard: i64 = region.loadI64(READ_AT, SEQ_CST)
  const timed: i32 = n - warm
  console.log(
    `${mode} ${size} n ${n} body_bytes ${bodies / toI64(n)} p50_ns ${percentile(hist, timed, 50)} p99_ns ${percentile(hist, timed, 99)} mean_ns ${sum / toI64(timed)} wall_ns ${wall / toI64(n)} copied ${copied / toI64(n)} waited_ns ${waited / toI64(n)} sent ${sent + bodies} heard ${heard}`
  )
  return 0
}

export const main = (): i32 => {
  const args = process.argv
  if (args.length > 5 && args[1] === "producer") {
    return producer(
      openRegion(args[2]).expect("open"),
      args[3],
      toI32(Number(args[4])),
      toI32(Number(args[5]))
    )
  }
  if (args.length > 3 && args[1] === "reader") {
    return reader(openRegion(args[2]).expect("open"), toI32(Number(args[3])))
  }
  if (args.length < 6) {
    console.log("usage: bench <copy|inplace> <size> <n> <producer-cpu> <reader-cpu>")
    return 2
  }
  if (RING_AT + spscRingBytes(CAP) > BYTES) {
    panic("bench/ring-inplace: the region is too small for the ring")
  }
  const name: string = `nish-bench-inplace-${monotonicNanos() % toI64(1000000000)}`
  const region = createRegion(name, BYTES).expect("create")
  const rc: i32 = consumer(
    region,
    name,
    args[1],
    toI32(Number(args[2])),
    toI32(Number(args[3])),
    args[4],
    args[5]
  )
  unlinkRegion(name).expect("unlink")
  return rc
}
