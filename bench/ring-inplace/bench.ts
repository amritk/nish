// The program half of bench/ring-inplace (run.mjs): a JSON record goes from a
// producer process, through an `SpscRing` in a `nish/sync/shm` region, to an
// `Http1Connection` that answers a keep-alive request with it, and on to a
// reader process that drains the socket. Three processes on three cores:
//
//     bench <copy|inplace|consumer> <size> <n> <producer-cpu> <reader-cpu> [ring-bytes]
//
//   copy     the producer renders into a private buffer and `tryPush`es it;
//            the consumer `tryPop`s it into a buffer of its own and hands it
//            to `Http1Connection.write`, which copies it into the output
//   inplace  the producer renders into the window `reserve` lends and
//            `commit`s it; the consumer `peek`s it, hands the ring's own
//            bytes to `sendBody`, which sends them from there, and `release`s
//   consumer the producer's half of copy and the consumer's half of inplace:
//            render privately and `tryPush`, then `peek`, `sendBody`, `release`
//
// The ring holds `ring-bytes` of records, 16 MB (16777216) by default: a
// power of two, at least twice the record and 8 more (`reserve`'s limit).
// In consumer mode a record `tryPush` wrapped across the ring's end cannot
// be lent, so `peek` answers none for it and `tryPop` copies it out, counted
// in `copied` and in `wrapped`; in place no record wraps.
//
// The consumer is the parent: it answers `n` requests, timing each from the
// request to the flush less any wait for the producer, and prints one line
// of `name value` pairs: the per-message p50, p99 and mean in nanoseconds,
// the wall time per message (the whole pipeline's, waits and all), and the
// bytes of body copied in user space over the run, counted here: `tryPush`,
// `tryPop` and `write` in copy mode; in place, what `sendBody` copied of what
// the socket did not take, and on how many messages (`tails`); in consumer
// mode, `tryPush`, the in-place consumer's, and the `tryPop` of each record
// that wrapped. `stalls` counts the messages whose response head found no
// room behind the last message's tail, so the consumer drained before
// `respond`; that drain is inside the timed window. Not counted, in any mode: the response head, which `respond` writes into the output; the
// kernel's copy into the socket; `Http1Connection`'s compaction of its output;
// and the reader's `netRead`. The reader's byte count must equal what the
// consumer sent, and its FNV-1a over the bodies it parses out of the stream
// must equal the producer's over the records it rendered; run.mjs checks both.
// Every wait in the three processes has a deadline of ten seconds (the
// reader's counts from its start, then from its last byte; the connect
// wait's is five), and a child that fails fails the run. The one exception
// is the parent's `waitPid` on each child once the run is over: it has no
// deadline of its own, and is bounded by the children's deadlines and by
// run.mjs's timeout on the whole program.
// The producer and the reader are this program again, under
// `taskset -c <cpu>` when that is not -1; run.mjs pins the parent.
import { kill, monotonicNanos, spawn, waitPid } from "nish:process"
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

/** The ring's data bytes unless the command line says otherwise: 16 MB of records. */
const DEFAULT_RING_BYTES: i32 = 16777216
/** Set by the producer once it has attached. */
const READY_AT: i32 = 0
/** The bytes the producer copied, which it stores before it exits. */
const PRODUCER_COPIED_AT: i32 = 8
/** The bytes the reader read, which it stores before it exits. */
const READ_AT: i32 = 16
/** FNV-1a over every record the producer rendered, in order. */
const PRODUCER_SUM_AT: i32 = 24
/** FNV-1a over every body the reader parsed out of the stream, in order. */
const READ_SUM_AT: i32 = 32
const RING_AT: i32 = 64
/** Per-message times in 10 ns buckets up to 200 µs; a longer one counts in the last. */
const BUCKETS: i32 = 20001
const PINNED_MS: i64 = 1792138314000
const POLL_IN: i32 = 1
/** How long any wait may take before the run fails: ten seconds. */
const DEADLINE_NS: i64 = 10000000000
const FNV_BASIS: i64 = 2166136261

/** FNV-1a: `h` folded over `buf[off..off+len)`. */
const fnv = (h: u32, buf: readonly u8[], off: i32, len: i32): u32 => {
  let x: u32 = h
  for (let k: i32 = off; k >= 0 && k < off + len && k < toI32(buf.length); k++) {
    x = (x ^ toU32(buf[k])) * 16777619
  }
  return x
}

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

/**
 * Whether `mode` is one this program runs. `main` and `producer` check it
 * first, so past them `mode !== "inplace"` means the producer `tryPush`es and
 * `mode !== "copy"` means the consumer `peek`s.
 */
const knownMode = (mode: string): boolean => mode === "copy" || mode === "inplace" || mode === "consumer"

/** Whether `cap` is a ring capacity `size`-byte records can be reserved and pushed in. */
const ringFits = (cap: i32, size: i32): boolean =>
  cap >= 8 && (cap & (cap - 1)) === 0 && size >= 1 && size <= cap / 2 - 4

const producer = (region: SharedRegion, mode: string, size: i32, n: i32, cap: i32): i32 => {
  if (!knownMode(mode)) {
    panic(`bench/ring-inplace: the producer has an unknown mode ${mode}`)
  }
  const pushes: boolean = mode !== "inplace"
  const ring: SpscRing = attachSpscRing(region, RING_AT).expect("attach")
  if (ring.capacity !== cap) {
    panic(`bench/ring-inplace: the ring holds ${ring.capacity} bytes, not the ${cap} asked for`)
  }
  const own: u8[] = new Array<u8>(size)
  const w = new JsonWriter(own, 0)
  let copied: i64 = toI64(0)
  let sum: u32 = toU32(FNV_BASIS)
  region.storeI32(READY_AT, 1, SEQ_CST)
  for (let i: i32 = 0; i < n; i++) {
    if (pushes) {
      w.reset(own, 0)
      const len: i32 = render(w, i, size)
      sum = fnv(sum, own, 0, len)
      const since: i64 = monotonicNanos()
      while (!ring.tryPush(own, 0, len)) {
        // full: spin until the consumer takes one
        if (monotonicNanos() - since > DEADLINE_NS) {
          panic(`bench/ring-inplace: the ring stayed full at record ${i}`)
        }
      }
      copied = copied + toI64(len)
    } else {
      const since: i64 = monotonicNanos()
      let win: u8[] = ring.reserve(size)
      while (win.length === 0) {
        if (monotonicNanos() - since > DEADLINE_NS) {
          panic(`bench/ring-inplace: the ring stayed full at record ${i}`)
        }
        win = ring.reserve(size)
      }
      w.reset(win, 0)
      const len: i32 = render(w, i, size)
      sum = fnv(sum, win, 0, len)
      ring.commit(len)
    }
  }
  region.storeI64(PRODUCER_COPIED_AT, copied, SEQ_CST)
  region.storeI64(PRODUCER_SUM_AT, toI64(sum), SEQ_CST)
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

/** The value of `content-length` in the response head `head[0..end)`, or -1. */
const contentLength = (head: readonly u8[], end: i32): i32 => {
  const want: string = "\ncontent-length:"
  const m: i32 = toI32(want.length)
  for (let a: i32 = 0; a + m <= end; a++) {
    let k: i32 = 0
    while (k < m) {
      let c: i32 = toI32(head[a + k])
      if (c >= 65 && c <= 90) {
        c = c + 32
      }
      if (c !== toI32(want.charCodeAt(k))) {
        break
      }
      k = k + 1
    }
    if (k === m) {
      let at: i32 = a + m
      while (at >= 0 && at < toI32(head.length) && at < end && toI32(head[at]) === 32) {
        at = at + 1
      }
      let v: i32 = 0
      while (
        at >= 0 &&
        at < toI32(head.length) &&
        at < end &&
        toI32(head[at]) >= 48 &&
        toI32(head[at]) <= 57
      ) {
        v = v * 10 + toI32(head[at]) - 48
        at = at + 1
      }
      return v
    }
  }
  return -1
}

const reader = (region: SharedRegion, port: i32): i32 => {
  const addr: u8[] = new Array<u8>(18)
  netAddress(addr, "127.0.0.1", port)
  const fd: i32 = tcpConnect(addr)
  const buf: u8[] = new Array<u8>(262144)
  let total: i64 = toI64(0)
  // The stream parsed as it comes: a head up to its blank line, then as many
  // body bytes as its `content-length` says, folded into the sum.
  const head: u8[] = new Array<u8>(4096)
  let headEnd: i32 = 0
  let bodyLeft: i32 = 0
  let sum: u32 = toU32(FNV_BASIS)
  let heard: i64 = monotonicNanos()
  while (true) {
    const got: i32 = netRead(fd, buf, 0, toI32(buf.length))
    if (got > 0) {
      heard = monotonicNanos()
      total = total + toI64(got)
      let at: i32 = 0
      while (at < got) {
        if (bodyLeft > 0) {
          const take: i32 = got - at < bodyLeft ? got - at : bodyLeft
          sum = fnv(sum, buf, at, take)
          bodyLeft = bodyLeft - take
          at = at + take
        } else {
          if (headEnd < 0 || headEnd >= toI32(head.length) || at < 0 || at >= toI32(buf.length)) {
            panic("bench/ring-inplace: a response head is longer than 4096 bytes")
          }
          head[headEnd] = buf[at]
          headEnd = headEnd + 1
          at = at + 1
          if (
            headEnd >= 4 &&
            toI32(head[headEnd - 4]) === 13 &&
            toI32(head[headEnd - 3]) === 10 &&
            toI32(head[headEnd - 2]) === 13 &&
            toI32(head[headEnd - 1]) === 10
          ) {
            bodyLeft = contentLength(head, headEnd)
            if (bodyLeft < 0) {
              panic("bench/ring-inplace: a response head has no content-length")
            }
            headEnd = 0
          }
        }
      }
    } else if (got === 0) {
      break
    } else if (got !== H1_AGAIN) {
      console.log(`reader: netRead answered ${got}`)
      break
    }
    // -11: spin, the reader has a core of its own, until nothing has come
    // for as long as any wait may take
    if (monotonicNanos() - heard > DEADLINE_NS) {
      panic(`bench/ring-inplace: the reader heard nothing for ten seconds after ${total} bytes`)
    }
  }
  netClose(fd)
  region.storeI64(READ_AT, total, SEQ_CST)
  region.storeI64(READ_SUM_AT, toI64(sum), SEQ_CST)
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

/**
 * Fails the run: stops both children, takes the region away so it does not
 * outlive the run, and panics with `why`.
 */
const fail = (name: string, prod: i32, read: i32, why: string): void => {
  if (prod > 0) {
    kill(prod, 9)
  }
  if (read > 0) {
    kill(read, 9)
  }
  const gone = unlinkRegion(name)
  panic(`bench/ring-inplace: ${why}${gone.isErr() ? " (the region stays)" : ""}`)
}

/** Reaps `pid`; fails the run unless it exited with status 0. */
const reap = (name: string, pid: i32, role: string): void => {
  const r: i32[] = waitPid(pid, 0)
  if (r[0] !== pid || r[1] !== 0) {
    fail(name, -1, -1, `the ${role} exited with [${r[0]}, ${r[1]}]`)
  }
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

/** Sends what the connection holds until it holds nothing; fails the run if that takes past the deadline. */
const drain = (server: Http1Server, conn: Http1Connection, name: string, prod: i32, read: i32): void => {
  server.flush(0)
  const since: i64 = monotonicNanos()
  while (conn.wantsWrite()) {
    if (monotonicNanos() - since > DEADLINE_NS) {
      fail(name, prod, read, "the reader stopped taking the output")
    }
    server.flush(0)
  }
}

const consumer = (
  region: SharedRegion,
  name: string,
  mode: string,
  size: i32,
  n: i32,
  cap: i32,
  pcpu: string,
  rcpu: string
): i32 => {
  const peeks: boolean = mode !== "copy"
  const ring: SpscRing = initSpscRing(region, RING_AT, cap, false)
  const listener: i32 = tcpListen("127.0.0.1", 0, 4)
  const server = new Http1Server(new Http1Config(), listener, 1)
  server.date.pin(PINNED_MS)
  const prod: i32 = child(pcpu, "producer", [name, mode, `${size}`, `${n}`, `${cap}`])
  const read: i32 = child(rcpu, "reader", [name, `${netLocalPort(listener)}`])
  if (prod <= 0 || read <= 0) {
    fail(name, prod, read, `cannot start the children: ${prod} ${read}`)
  }
  if (!readable(listener) || server.accept() !== 0) {
    fail(name, prod, read, "the reader did not connect")
  }
  const since: i64 = monotonicNanos()
  while (region.loadI32(READY_AT, SEQ_CST) === 0) {
    // spin until the producer has attached
    if (monotonicNanos() - since > DEADLINE_NS) {
      fail(name, prod, read, "the producer did not attach")
    }
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
  let tails: i32 = 0
  let wrapped: i32 = 0
  let stalls: i32 = 0
  let tailBytes: i64 = toI64(0)
  let sent: i64 = toI64(0)
  let bodies: i64 = toI64(0)
  let waited: i64 = toI64(0)
  const start: i64 = monotonicNanos()
  for (let i: i32 = 0; i < n; i++) {
    const t0: i64 = monotonicNanos()
    conn.feed(request, 0, toI32(request.length))
    let e: i32 = server.next(0)
    while (e !== H1_REQUEST) {
      if (e < 0 || e === 0 || monotonicNanos() - t0 > DEADLINE_NS) {
        fail(name, prod, read, `request ${i} answered event ${e}`)
      }
      e = server.next(0)
    }
    // The record. A wait for the producer is not the consumer's cost: the
    // time from the first attempt to the start of the one that found it
    // comes off the message's time. When `peek` lends none, there is none
    // (a wait), or there is one `tryPush` wrapped across the ring's end,
    // which `peek` cannot lend: `tryPop` copies that one out, counted. In
    // place, every record is one `commit`, which never wraps.
    let body: readonly u8[] = own
    let len: i32 = RING_EMPTY
    let lent: boolean = false
    let tried: i64 = monotonicNanos()
    const first: i64 = tried
    while (len === RING_EMPTY) {
      tried = monotonicNanos()
      if (tried - first > DEADLINE_NS) {
        fail(name, prod, read, `no record ${i} from the producer`)
      }
      if (peeks) {
        const r: readonly u8[] = ring.peek()
        if (r.length > 0) {
          body = r
          len = toI32(r.length)
          lent = true
        } else if (ring.head !== ring.seenTail) {
          // `peek` saw a record (the producer's position it loaded is past
          // the consumer's) and would not lend it: one that wrapped. Without
          // this check `tryPop` would also take records published since
          // `peek` looked, which `peek` could have lent.
          len = ring.tryPop(own, 0)
          if (len >= 0) {
            copied = copied + toI64(len)
            wrapped = wrapped + 1
          }
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
    let queued: i32 = conn.outputEnd - conn.outputStart
    let head: i32 = conn.respond(200, names, values, len)
    // No room for the head behind that tail yet: send it, then answer.
    const stalled: i64 = monotonicNanos()
    if (head === H1_AGAIN) {
      stalls = stalls + 1
    }
    while (head === H1_AGAIN) {
      if (monotonicNanos() - stalled > DEADLINE_NS) {
        fail(name, prod, read, `respond found no room on ${i}`)
      }
      drain(server, conn, name, prod, read)
      queued = conn.outputEnd - conn.outputStart
      head = conn.respond(200, names, values, len)
    }
    if (head !== 0) {
      fail(name, prod, read, `respond answered ${head} on ${i}`)
    }
    sent = sent + toI64(conn.outputEnd - conn.outputStart - queued)
    bodies = bodies + toI64(len)
    let off: i32 = 0
    let tailed: boolean = false
    while (off < len) {
      const took: i32 = peeks ? conn.sendBody(body, off, len - off) : conn.write(own, off, len - off)
      if (took > 0) {
        if (!peeks) {
          copied = copied + toI64(took)
        } else {
          // What sendBody copied: all it took when the socket took none of
          // the body, otherwise what is left in the output.
          const left: i32 = conn.outputEnd - conn.outputStart
          const tail: i32 = left < took ? left : took
          copied = copied + toI64(tail)
          tailBytes = tailBytes + toI64(tail)
          if (tail > 0) {
            tailed = true
          }
        }
        off = off + took
      } else if (took !== H1_AGAIN) {
        fail(name, prod, read, `the body answered ${took} on ${i}`)
      }
      if (off < len) {
        // Short: send what is queued until the connection asks for more.
        drain(server, conn, name, prod, read)
        const short: i64 = monotonicNanos()
        while (server.next(0) !== H1_WRITE) {
          if (monotonicNanos() - short > DEADLINE_NS) {
            fail(name, prod, read, `the reader stopped taking at ${i}`)
          }
          drain(server, conn, name, prod, read)
        }
      }
    }
    if (tailed) {
      tails = tails + 1
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
  drain(server, conn, name, prod, read)
  const wall: i64 = monotonicNanos() - start
  server.close(0)
  netClose(listener)
  reap(name, prod, "producer")
  reap(name, read, "reader")
  copied = copied + region.loadI64(PRODUCER_COPIED_AT, SEQ_CST)
  const heard: i64 = region.loadI64(READ_AT, SEQ_CST)
  const made: i64 = region.loadI64(PRODUCER_SUM_AT, SEQ_CST)
  const parsed: i64 = region.loadI64(READ_SUM_AT, SEQ_CST)
  const timed: i32 = n - warm
  // The mean body to two decimals, rounded: integer hundredths, then split.
  const cents: i64 = (bodies * toI64(100) + toI64(n / 2)) / toI64(n)
  const frac: i64 = cents % toI64(100)
  console.log(
    `${mode} ${size} n ${n} ring ${cap} body_bytes ${cents / toI64(100)}.${frac < toI64(10) ? "0" : ""}${frac} p50_ns ${percentile(hist, timed, 50)} p99_ns ${percentile(hist, timed, 99)} mean_ns ${sum / toI64(timed)} wall_ns ${wall / toI64(n)} copied ${copied} tails ${tails} tail_bytes ${tailBytes} wrapped ${wrapped} stalls ${stalls} waited_ns ${waited / toI64(n)} sent ${sent + bodies} heard ${heard} made_sum ${made} read_sum ${parsed}`
  )
  return 0
}

export const main = (): i32 => {
  const args = process.argv
  if (args.length > 6 && args[1] === "producer") {
    return producer(
      openRegion(args[2]).expect("open"),
      args[3],
      toI32(Number(args[4])),
      toI32(Number(args[5])),
      toI32(Number(args[6]))
    )
  }
  if (args.length > 3 && args[1] === "reader") {
    return reader(openRegion(args[2]).expect("open"), toI32(Number(args[3])))
  }
  if (args.length < 6) {
    console.log("usage: bench <copy|inplace|consumer> <size> <n> <producer-cpu> <reader-cpu> [ring-bytes]")
    return 2
  }
  const mode: string = args[1]
  if (!knownMode(mode)) {
    console.log(`bench/ring-inplace: unknown mode ${mode}; the modes are copy, inplace and consumer`)
    return 2
  }
  const size: i32 = toI32(Number(args[2]))
  const n: i32 = toI32(Number(args[3]))
  const cap: i32 = args.length > 6 ? toI32(Number(args[6])) : DEFAULT_RING_BYTES
  if (n < 1 || !ringFits(cap, size)) {
    console.log(
      `bench/ring-inplace: ${n} records of ${size} bytes in a ring of ${cap}: the ring is a power of two of at least twice the record and 8 more, and n at least 1`
    )
    return 2
  }
  const bytes: i32 = RING_AT + spscRingBytes(cap)
  const name: string = `nish-bench-inplace-${monotonicNanos() % toI64(1000000000)}`
  const region = createRegion(name, bytes).expect("create")
  const rc: i32 = consumer(region, name, mode, size, n, cap, args[4], args[5])
  unlinkRegion(name).expect("unlink")
  return rc
}
