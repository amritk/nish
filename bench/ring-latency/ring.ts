// The ring half of bench/ring-latency (run.mjs): two processes on two cores
// hand 16-byte messages through `nish/sync/ring` in a `nish/sync/shm` region.
//
//     ring <mode> <n> <child-cpu>
//
//   pingpong  the parent pushes a message on one SPSC ring and waits for the
//             child's echo on another; prints the round trip's p50, p99 and
//             mean in nanoseconds
//   stream    the parent pushes n messages as fast as the ring takes them and
//             the child pops them in batches; prints messages a second
//   idle      the parent pushes one message a millisecond, so the child is
//             asleep on the doorbell for each; prints the count, for strace
//
// The child is this program again, started under `taskset -c <child-cpu>`
// when that is not -1; run.mjs pins the parent to another core.
import { getI64LE, setI64LE } from "nish/bytes"
import { monotonicNanos, spawn, waitPid } from "nish:process"
import { attachSpscRing, initSpscRing, RING_EMPTY, SpscRing } from "nish/sync/ring"
import { createRegion, openRegion, SEQ_CST, SharedRegion, unlinkRegion } from "nish/sync/shm"

const MSG: i32 = 16
const CAP: i32 = 65536
const READY_AT: i32 = 0
const TO_CHILD_AT: i32 = 64
const TO_PARENT_AT: i32 = TO_CHILD_AT + 65536 + 256
const BYTES: i32 = TO_PARENT_AT + 65536 + 256
const STOP: i64 = -1

/** The next message, sleeping on the doorbell between; its first i64. */
const take = (ring: SpscRing, buf: u8[]): i64 => {
  while (ring.popWait(buf, 0, 10000) === RING_EMPTY) {
    // the timeout passed with nothing queued: wait again
  }
  return getI64LE(buf, 0)
}

/** The bucket, in ns, below which `pct` percent of `n` round trips fell. */
const ringPercentile = (hist: i32[], n: i32, pct: i32): i32 => {
  const want: i64 = (toI64(n) * toI64(pct) + toI64(99)) / toI64(100)
  let seen: i64 = toI64(0)
  for (let k = 0; k < hist.length; k++) {
    seen = seen + toI64(hist[k])
    if (seen >= want) {
      return k * 10
    }
  }
  return 100000
}

const send = (ring: SpscRing, buf: u8[], v: i64): void => {
  setI64LE(buf, 0, v)
  while (!ring.tryPush(buf, 0, MSG)) {
    // full: spin until the consumer takes one
  }
}

const child = (region: SharedRegion, mode: string): i32 => {
  const down = attachSpscRing(region, TO_CHILD_AT).expect("down")
  const up = attachSpscRing(region, TO_PARENT_AT).expect("up")
  const buf: u8[] = new Array<u8>(MSG * 256)
  const lens: i32[] = new Array<i32>(256)
  region.storeI32(READY_AT, 1, SEQ_CST)
  if (mode === "pingpong") {
    while (true) {
      const v: i64 = take(down, buf)
      send(up, buf, v)
      if (v === STOP) {
        return 0
      }
    }
  }
  // stream and idle: count until the stop message, then report the count.
  let n: i64 = toI64(0)
  while (true) {
    const k: i32 = down.popBatch(buf, lens)
    if (k === 0) {
      if (down.popWait(buf, 0, 10000) === RING_EMPTY) {
        continue
      }
      if (getI64LE(buf, 0) === STOP) {
        break
      }
      n = n + 1
      continue
    }
    if (k > 0 && getI64LE(buf, (k - 1) * MSG) === STOP) {
      n = n + toI64(k - 1)
      break
    }
    n = n + toI64(k)
  }
  send(up, buf, n)
  return 0
}

const parent = (region: SharedRegion, name: string, mode: string, n: i32, cpu: string): i32 => {
  const down = initSpscRing(region, TO_CHILD_AT, CAP, true)
  const up = initSpscRing(region, TO_PARENT_AT, CAP, true)
  const argv: string[] = cpu === "-1" ? [] : ["taskset", "-c", cpu]
  argv.push(process.argv[0])
  argv.push("child")
  argv.push(name)
  argv.push(mode)
  const pid: i32 = spawn(argv)
  if (pid <= 0) {
    console.log(`cannot start the child: ${pid}`)
    return 1
  }
  while (region.loadI32(READY_AT, SEQ_CST) === 0) {
    // spin until the child has attached
  }
  const buf: u8[] = new Array<u8>(MSG)
  if (mode === "pingpong") {
    const warm: i32 = n / 10
    // Round trips in 10 ns buckets to 100 µs; a longer one counts in the last.
    const hist: i32[] = new Array<i32>(10001)
    let sum: i64 = toI64(0)
    for (let i = 0; i < n + warm; i++) {
      const t0: i64 = monotonicNanos()
      send(down, buf, toI64(i))
      take(up, buf)
      if (i >= warm) {
        const d: i64 = monotonicNanos() - t0
        sum = sum + d
        const k: i32 = d >= toI64(100000) ? 10000 : toI32(d / toI64(10))
        if (k >= 0 && k < hist.length) {
          hist[k] = hist[k] + 1
        }
      }
    }
    send(down, buf, STOP)
    take(up, buf)
    console.log(
      `pingpong ${n} p50_ns ${ringPercentile(hist, n, 50)} p99_ns ${ringPercentile(hist, n, 99)} mean_ns ${sum / toI64(n > 0 ? n : 1)}`
    )
  } else {
    const t0: i64 = monotonicNanos()
    for (let i = 0; i < n; i++) {
      send(down, buf, toI64(i))
      if (mode === "idle") {
        region.waitI32(READY_AT + 4, 0, 1) // a millisecond with nothing to do
      }
    }
    send(down, buf, STOP)
    const got: i64 = take(up, buf)
    const ns: i64 = monotonicNanos() - t0
    console.log(
      `${mode} ${n} got ${got} msgs_per_s ${(toI64(n) * toI64(1000000000)) / (ns > toI64(0) ? ns : toI64(1))}`
    )
  }
  waitPid(pid, 0)
  return 0
}

export const main = (): i32 => {
  const args = process.argv
  if (args.length > 3 && args[1] === "child") {
    return child(openRegion(args[2]).expect("open"), args[3])
  }
  if (args.length < 4) {
    console.log("usage: ring <pingpong|stream|idle> <n> <child-cpu>")
    return 2
  }
  const name: string = `nish-bench-ring-${monotonicNanos() % toI64(1000000000)}`
  const region = createRegion(name, BYTES).expect("create")
  const rc: i32 = parent(region, name, args[1], toI32(Number(args[2])), args[3])
  unlinkRegion(name).expect("unlink")
  return rc
}
