// When to start a batch: nish/net/postgres's PgBatchClock against fixed
// windows, at three steady arrival rates. A simulation, not a server: it
// reads no clock and opens no socket, and the same build prints the same
// table every run.
//
//   build/nish bench/pg-batch-clock.ts --link build/pg-batch-clock --profile speed
//   build/pg-batch-clock
//
// The model, after a Conduit API box (4 workers on 8 vCPUs). Requests arrive
// one at a time at a steady Poisson rate; each wants one keyed read. A pool
// of 4 connections runs batches, one at a time on each. A batch of n reads
// costs the server 70 + 20 * n microseconds of CPU, the 70 being the
// statement's own parse, plan and round trip. The app's own work, 400 us of
// CPU a request on the same 8 cores, slows every statement by 1 / (1 - load)
// as the box fills up, which is what "near saturation" means here.
//
// Every policy is the real clock, only configured apart:
//
//   none      maxWaitUs 0: an item starts a batch the moment a connection is free
//   fixed     minCount = maxCount = 128, factor 0, maxWaitUs 10 or 30 ms: the default
//   adaptive  minCount 16, factor 1.1, weight 0.25, maxWaitUs 10 ms, lightCount 8 in 10 ms
//
// For each it prints the mean batch size, the wait batching added to each
// item (from its arrival to its batch's start, p50 and p95, in ms),
// statements per item, and server CPU per item in microseconds. The last
// lines say, per rate, whether adaptive matched the better fixed window: its
// p95 no higher than the lower fixed p95, and its server CPU per item within
// 5% of the lower fixed one wherever the box is a quarter busy or more (below
// that the server is idle, and the clock spends statements on latency on
// purpose).
import { PgBatchClock, PgBatchClockConfig, PG_CLOCK_WAIT } from "nish/net/postgres"

const CONNECTIONS: i32 = 4
const MAX_COUNT: i32 = 128
const STATEMENT_US: f64 = 70.0
const ROW_US: f64 = 20.0
const APP_US: f64 = 400.0
const CORES: f64 = 8.0
const SECONDS: f64 = 20.0
// Past this the model's slowdown runs away; the rates below stay under it.
const MAX_LOAD: f64 = 0.95
const ONE: f64 = 1.0
const MILLION: f64 = 1000000.0
const QUEUE: i32 = 1048576
// Waits are counted in 10 us buckets up to a second, so a percentile needs no sort.
const BUCKET_US: i64 = 10
const BUCKETS: i32 = 100000

/** One run's figures. */
class Figures {
  items: i64 = 0
  batches: i64 = 0
  serverUs: f64 = 0.0
  p50Us: i64 = 0
  p95Us: i64 = 0
  load: f64 = 0.0
}

/** xorshift32, so every run draws the same arrivals. */
class Draw {
  state: i32 = 2463534242

  /** A uniform draw in (0, 1]. */
  next(): f64 {
    let x: i32 = this.state
    x = x ^ (x << 13)
    x = x ^ (x >>> 17)
    x = x ^ (x << 5)
    this.state = x
    return toF64((x & 2147483647) + 1) / 2147483648.0
  }
}

const config = (minCount: i32, factor: f64, maxWaitUs: i64, lightCount: i32): PgBatchClockConfig => {
  const c = new PgBatchClockConfig()
  c.maxCount = MAX_COUNT
  c.minCount = minCount
  c.factor = factor
  c.maxWaitUs = maxWaitUs
  c.lightCount = lightCount
  c.lightWindowUs = 10000
  c.queueSize = QUEUE
  return c
}

/** The percentile `p` (0 to 100) of `count` waits in `hist`, in us. */
const percentile = (hist: i64[], count: i64, p: i64): i64 => {
  const want: i64 = (count * p + 99) / 100
  let seen: i64 = 0
  for (let i: i32 = 0; i < toI32(hist.length); i++) {
    seen += hist[i]
    if (seen >= want) {
      return toI64(i) * BUCKET_US
    }
  }
  return toI64(BUCKETS) * BUCKET_US
}

/** Runs `SECONDS` of arrivals at `rate` a second through a clock of `c`. */
const run = (rate: f64, c: PgBatchClockConfig, arrivals: i64[], hist: i64[]): Figures => {
  const clock = new PgBatchClock(c)
  const draw = new Draw()
  const busyUntil: i64[] = new Array<i64>(CONNECTIONS)
  for (let i: i32 = 0; i < toI32(hist.length); i++) {
    hist[i] = 0
  }
  const load: f64 = (rate * APP_US) / MILLION / CORES
  const capped: f64 = load < MAX_LOAD ? load : MAX_LOAD
  const stretch: f64 = ONE / (ONE - capped)
  const end: i64 = toI64(SECONDS * MILLION)
  const f = new Figures()
  let head: i32 = 0
  let count: i32 = 0
  let inFlight: i32 = 0
  let now: i64 = 0
  let nextArrival: i64 = toI64((-Math.log(draw.next()) * MILLION) / rate)
  while (now < end || count > 0 || inFlight > 0) {
    // Free the connections whose batch is done, then start every batch that is due.
    for (let i: i32 = 0; i < toI32(busyUntil.length); i++) {
      if (busyUntil[i] > 0 && busyUntil[i] <= now) {
        busyUntil[i] = 0
        inFlight -= 1
      }
    }
    let free: i32 = -1
    for (let i: i32 = 0; i < toI32(busyUntil.length); i++) {
      if (busyUntil[i] === 0) {
        free = i
        break
      }
    }
    while (free >= 0 && count > 0 && (clock.check(now, inFlight) !== PG_CLOCK_WAIT || now >= end)) {
      const n: i32 = count < MAX_COUNT ? count : MAX_COUNT
      for (let k: i32 = 0; k < n; k++) {
        const wait: i64 = now - arrivals[(head + k) % QUEUE]
        const b: i64 = wait / BUCKET_US
        const at: i32 = b < toI64(BUCKETS) ? toI32(b) : BUCKETS - 1
        hist[at] += 1
      }
      head = (head + n) % QUEUE
      count -= n
      clock.started(n, now)
      const work: f64 = STATEMENT_US + ROW_US * toF64(n)
      f.serverUs += work
      f.batches += 1
      f.items += toI64(n)
      busyUntil[free] = now + 1 + toI64(work * stretch)
      inFlight += 1
      free = -1
      for (let i: i32 = 0; i < toI32(busyUntil.length); i++) {
        if (busyUntil[i] === 0) {
          free = i
          break
        }
      }
    }
    // The next event: an arrival, a batch done, or the timer while a connection is free.
    let next: i64 = now < end ? nextArrival : end + toI64(SECONDS * MILLION)
    for (let i: i32 = 0; i < toI32(busyUntil.length); i++) {
      if (busyUntil[i] > 0 && busyUntil[i] < next) {
        next = busyUntil[i]
      }
    }
    const deadline: i64 = clock.deadline()
    if (free >= 0 && deadline > now && deadline < next) {
      next = deadline
    }
    if (now >= end && count > 0 && free >= 0) {
      next = now
    }
    now = next
    if (now === nextArrival && now < end) {
      arrivals[(head + count) % QUEUE] = now
      count += 1
      clock.arrived(now)
      nextArrival = now + 1 + toI64((-Math.log(draw.next()) * MILLION) / rate)
    }
  }
  f.p50Us = percentile(hist, f.items, 50)
  f.p95Us = percentile(hist, f.items, 95)
  f.load = load + (rate * (f.serverUs / toF64(f.items))) / MILLION / CORES
  return f
}

const ms = (us: i64): string => {
  const hundredths: i64 = (us + 5) / 10
  const frac: i64 = hundredths % 100
  return `${hundredths / 100}.${frac < 10 ? "0" : ""}${frac}`
}

const fixed3 = (x: f64): string => {
  const thousandths: i64 = toI64(x * 1000.0 + 0.5)
  const frac: i64 = thousandths % 1000
  let pad: string = ""
  if (frac < 10) {
    pad = "00"
  } else if (frac < 100) {
    pad = "0"
  }
  return `${thousandths / 1000}.${pad}${frac}`
}

const fixed1 = (x: f64): string => {
  const tenths: i64 = toI64(x * 10.0 + 0.5)
  return `${tenths / 10}.${tenths % 10}`
}

const row = (name: string, f: Figures): string => {
  const size: f64 = toF64(f.items) / toF64(f.batches)
  const perItem: f64 = toF64(f.batches) / toF64(f.items)
  const cpu: f64 = f.serverUs / toF64(f.items)
  return `| ${name} | ${fixed1(size)} | ${ms(f.p50Us)} | ${ms(f.p95Us)} | ${fixed3(perItem)} | ${fixed1(cpu)} |`
}

export const main = (): i32 => {
  const rates: f64[] = [1000.0, 8000.0, 16000.0]
  const names: string[] = ["quiet", "moderate", "near saturation"]
  const arrivals: i64[] = new Array<i64>(QUEUE)
  const hist: i64[] = new Array<i64>(BUCKETS)
  const verdicts: string[] = []
  for (let l: i32 = 0; l < toI32(rates.length); l++) {
    const rate: f64 = rates[l]
    const none = run(rate, config(1, 0.0, 0, 0), arrivals, hist)
    const w10 = run(rate, config(MAX_COUNT, 0.0, 10000, 0), arrivals, hist)
    const w30 = run(rate, config(MAX_COUNT, 0.0, 30000, 0), arrivals, hist)
    const adaptive = run(rate, config(16, 1.1, 10000, 8), arrivals, hist)
    console.log(`### ${names[l]}: ${toI64(rate)} requests/s, the box ${toI64(adaptive.load * 100.0)}% busy`)
    console.log("")
    console.log("| policy | batch | wait p50 ms | wait p95 ms | statements/item | server us/item |")
    console.log("| --- | ---: | ---: | ---: | ---: | ---: |")
    console.log(row("none", none))
    console.log(row("fixed 10 ms", w10))
    console.log(row("fixed 30 ms", w30))
    console.log(row("adaptive", adaptive))
    console.log("")
    const bestP95: i64 = w10.p95Us < w30.p95Us ? w10.p95Us : w30.p95Us
    const cpu10: f64 = w10.serverUs / toF64(w10.items)
    const cpu30: f64 = w30.serverUs / toF64(w30.items)
    const bestCpu: f64 = cpu10 < cpu30 ? cpu10 : cpu30
    const cpu: f64 = adaptive.serverUs / toF64(adaptive.items)
    const latency: boolean = adaptive.p95Us <= bestP95
    const busy: boolean = adaptive.load >= 0.25
    const cost: boolean = !busy || cpu <= bestCpu * 1.05
    const verdict: string = latency && cost ? "matches" : "falls short of"
    verdicts.push(
      `${names[l]}: adaptive ${verdict} the better fixed window (p95 ${ms(adaptive.p95Us)} against ${ms(bestP95)} ms, server ${fixed1(cpu)} against ${fixed1(bestCpu)} us/item${busy ? "" : ", not counted below a quarter busy"})`
    )
  }
  for (const v of verdicts) {
    console.log(v)
  }
  return 0
}
