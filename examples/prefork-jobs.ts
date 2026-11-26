// Work handed across cores without a socket: `nish/net/prefork` starts five
// worker processes, worker 0 owns a table of counters, and workers 1 to 4
// send it jobs ("add this to counter k") through one shared `MpscRing` and get
// each answer ("counter k is now v") back on an `MpscRing` of their own. All
// five rings live in one `nish/sync/shm` region the supervisor creates before
// it starts the workers, which open it by name; when they have all exited the
// supervisor reads the totals out of the region and unlinks it.
//
//     build/nish examples/prefork-jobs.ts --link build/prefork-jobs
//     build/prefork-jobs           # 4 workers sent 40000 jobs, ...
//     build/prefork-jobs my-name   # the region is /dev/shm/my-name
//
// A busy ring makes no system call; a consumer with nothing to do sleeps on
// the ring's futex doorbell, and the push that finds it asleep wakes it. Off
// Linux there is no doorbell and the waits poll. `NISH_WORKERS` overrides the
// five: with fewer, the owner and the clients each give up after a second
// with nothing to do, and with more, the extra workers exit at once.
import { tryGetI32LE, tryGetI64LE, trySetI32LE, trySetI64LE } from "nish/bytes"
import {
  PREFORK_WORKER_FLAG,
  PREFORK_WORKERS_EXITED,
  PreforkConfig,
  preforkArgs,
  tryPreforkWith,
} from "nish/net/prefork"
import { monotonicNanos } from "nish:process"
import {
  attachMpscRing,
  MpscRing,
  mpscRingBytes,
  RING_CORRUPT,
  RING_EMPTY,
  tryInitMpscRing,
} from "nish/sync/ring"
import {
  createRegion,
  openRegion,
  RELAXED,
  SEQ_CST,
  SHM_UNSUPPORTED,
  SharedRegion,
  unlinkRegion,
} from "nish/sync/shm"

const CLIENTS: i32 = 4
const JOBS: i32 = 10000
/** Jobs a client has in flight at most; its answer ring holds them all. */
const WINDOW: i32 = 32
const COUNTERS: i32 = 8

// The region: the totals, then the job ring, then one answer ring a client.
const FAILURES_AT: i32 = 0 // i32: answers a client found wrong
const ANSWERED_AT: i32 = 8 // i64: jobs the owner answered
const TOTAL_AT: i32 = 16 // i64: the counters' sum when the owner stopped
const JOBS_AT: i32 = 64
const JOB_SLOTS: i32 = 64
const JOB_BYTES: i32 = 16 // [client i32][seq i32][counter i32][amount i32]
const ANSWER_BYTES: i32 = 12 // [seq i32][value i64]
const ANSWER_SLOTS: i32 = WINDOW
const ANSWER_SLOT: i32 = 16 // a slot holds one answer, rounded up to 8
const WAIT_MS: i32 = 1000 // how long a worker waits on an empty ring
// The sum is a `u32`, whose arithmetic wraps rather than panics: `worker` is 1
// to 5 and the region is some tens of kilobytes, far below 4294967295.
const answersAt = (worker: i32): i32 =>
  toI32(
    toU32(JOBS_AT) +
      toU32(mpscRingBytes(JOB_SLOTS, JOB_BYTES)) +
      (toU32(worker) - 1) * toU32(mpscRingBytes(ANSWER_SLOTS, ANSWER_SLOT))
  )
const regionBytes = (): i32 => answersAt(CLIENTS + 1)

/**
 * The next record, sleeping on the doorbell when there is none; polling off
 * Linux. `take` and `takeWait` answer a slot a peer scribbled on as
 * `RING_CORRUPT` where `tryPop` and `popWait` would stop the program, which
 * is why the rings need no `--allow-panics`; the callers treat it as a ring
 * they can no longer trust.
 */
const takeRecord = (ring: MpscRing, buf: u8[]): i32 => {
  const n: i32 = ring.takeWait(buf, toI32(0), WAIT_MS)
  return n === SHM_UNSUPPORTED ? ring.take(buf, toI32(0)) : n
}

/**
 * Worker 0: answers jobs until every client says it is done, or a second
 * passes with none. The counts are `u64`, whose arithmetic wraps rather than
 * panics: they reach 200020000 at most, far below 2^64.
 */
const owner = (region: SharedRegion): i32 => {
  const jobs = attachMpscRing(region, JOBS_AT)
  if (jobs.isErr()) {
    console.error(`the job ring: ${jobs.error}`)
    return 1
  }
  const answers: MpscRing[] = []
  for (let c: i32 = 0; c < CLIENTS; c++) {
    const ring = attachMpscRing(region, answersAt(c + 1))
    if (ring.isErr()) {
      console.error(`an answer ring: ${ring.error}`)
      return 1
    }
    answers.push(ring.value)
  }
  // A `u16` length is one the compiler proves cannot be negative.
  const counters: u64[] = new Array<u64>(toU16(COUNTERS))
  const job: u8[] = new Array<u8>(toU16(JOB_BYTES))
  const answer: u8[] = new Array<u8>(toU16(ANSWER_BYTES))
  let done: i32 = 0
  let answered: u64 = toU64(0)
  // Every answer below 0 ends the loop: an empty ring, a record too long for
  // `job`, or a ring a peer scribbled on.
  while (done < CLIENTS && takeRecord(jobs.value, job) >= 0) {
    // `job` holds JOB_BYTES, so none of these reads is out of range; the
    // checked forms answer one that were as a record to skip.
    const clientAt = tryGetI32LE(job, 0)
    const counterAt = tryGetI32LE(job, 8)
    const tagAt = tryGetI32LE(job, 4)
    const addAt = tryGetI32LE(job, 12)
    if (clientAt.isErr() || counterAt.isErr() || tagAt.isErr() || addAt.isErr()) {
      continue
    }
    const client: i32 = clientAt.value
    const counter: i32 = counterAt.value
    if (counter < 0) {
      done = done + 1
      continue
    }
    if (client < 1 || counter >= toI32(counters.length)) {
      continue
    }
    const slot: i32 = client - 1
    if (slot >= toI32(answers.length)) {
      continue
    }
    counters[counter] = counters[counter] + toU64(addAt.value)
    if (!trySetI32LE(answer, 0, tagAt.value) || !trySetI64LE(answer, 4, toI64(counters[counter]))) {
      continue
    }
    // The client never has more in flight than its ring holds.
    answers[slot].offer(answer, toI32(0), ANSWER_BYTES)
    answered = answered + 1
  }
  let total: u64 = toU64(0)
  for (const v of counters) {
    total = total + v
  }
  region.storeI64(ANSWERED_AT, toI64(answered), RELAXED)
  region.storeI64(TOTAL_AT, toI64(total), SEQ_CST)
  return 0
}

/**
 * Workers 1 to 4: job `seq` adds `seq` to counter `seq % COUNTERS`. The counts
 * are `u32` and the clock `u64`, whose arithmetic wraps rather than panics:
 * no count passes 10001, and the clock only moves forward from `since`.
 */
const client = (region: SharedRegion, me: i32): i32 => {
  const jobs = attachMpscRing(region, JOBS_AT)
  if (jobs.isErr()) {
    console.error(`the job ring: ${jobs.error}`)
    return 1
  }
  const answers = attachMpscRing(region, answersAt(me))
  if (answers.isErr()) {
    console.error(`my answer ring: ${answers.error}`)
    return 1
  }
  const job: u8[] = new Array<u8>(toU16(JOB_BYTES))
  const answer: u8[] = new Array<u8>(toU16(ANSWER_BYTES))
  // `job` and `answer` hold JOB_BYTES and ANSWER_BYTES, so no checked access
  // below fails; one that did would count as a job that went wrong.
  trySetI32LE(job, 0, me)
  let sent: u32 = 1
  let got: u32 = 0
  let wrong: u32 = 0
  let since: u64 = toU64(monotonicNanos())
  while (got < toU32(JOBS)) {
    while (sent <= toU32(JOBS) && sent - 1 - got < toU32(WINDOW)) {
      trySetI32LE(job, 4, toI32(sent))
      trySetI32LE(job, 8, toI32(sent) % COUNTERS)
      trySetI32LE(job, 12, toI32(sent))
      if (jobs.value.offer(job, toI32(0), JOB_BYTES) !== 0) {
        break
      }
      sent = sent + 1
    }
    if (sent - 1 === got) {
      // Nothing of ours in flight: the job ring is full of the others' jobs.
      if (toU64(monotonicNanos()) - since > toU64(1000000000)) {
        break // a second without room: the owner is gone
      }
      continue
    }
    const took: i32 = takeRecord(answers.value, answer)
    if (took === RING_EMPTY || took === RING_CORRUPT) {
      break // a second with no answer, or a scribbled ring: the owner is gone
    }
    since = toU64(monotonicNanos())
    got = got + 1
    // Answers come back in order, and a counter only grows.
    const tag = tryGetI32LE(answer, 0)
    const value = tryGetI64LE(answer, 4)
    if (tag.isErr() || value.isErr() || tag.value !== toI32(got) || value.value < toI64(got)) {
      wrong = wrong + 1
    }
  }
  trySetI32LE(job, 8, -1)
  for (let k: i32 = 0; k < 1000000 && jobs.value.offer(job, toI32(0), JOB_BYTES) !== 0; k++) {
    // full: the owner is behind, so spin a while
  }
  region.addI32(FAILURES_AT, toI32(wrong + (toU32(JOBS) - got)), SEQ_CST)
  return 0
}

/** The supervisor: makes the region and its rings, runs the workers, reports. */
const supervise = (name: string): i32 => {
  const stale = unlinkRegion(name) // left by a run that was killed, if any
  if (stale.isErr()) {
    // None: the usual case.
  }
  const created = createRegion(name, regionBytes())
  if (created.isErr()) {
    console.error(`the region: ${created.error.message}`)
    return 1
  }
  const region = created.value
  const made = tryInitMpscRing(region, JOBS_AT, JOB_SLOTS, JOB_BYTES, true)
  if (made.isErr()) {
    console.error(`the job ring: ${made.error}`)
    return 1
  }
  for (let c: i32 = 0; c < CLIENTS; c++) {
    const ring = tryInitMpscRing(region, answersAt(c + 1), ANSWER_SLOTS, ANSWER_SLOT, true)
    if (ring.isErr()) {
      console.error(`an answer ring: ${ring.error}`)
      return 1
    }
  }
  const config = new PreforkConfig()
  config.workers = CLIENTS + 1
  config.restart = false
  const ran = tryPreforkWith(process.argv, config)
  if (ran.isErr()) {
    console.error(`the workers: ${ran.error}`)
    return 1
  }
  const ended: i32 = ran.value
  const unlinked = unlinkRegion(name)
  if (unlinked.isErr()) {
    console.error(`unlink the region: ${unlinked.error.message}`)
    return 1
  }
  const failures: i32 = region.loadI32(FAILURES_AT, SEQ_CST)
  const answered: i64 = region.loadI64(ANSWERED_AT, SEQ_CST)
  const total: i64 = region.loadI64(TOTAL_AT, SEQ_CST)
  console.log(`${CLIENTS} workers sent ${CLIENTS * JOBS} jobs; the owner answered ${answered}`)
  console.log(`the counters sum to ${total}; ${failures} answers were wrong or missing`)
  const want: i64 = (toI64(CLIENTS) * toI64(JOBS) * toI64(JOBS + 1)) / 2
  return ended === PREFORK_WORKERS_EXITED && failures === 0 && total === want ? 0 : 1
}

export const main = (): i32 => {
  const args = preforkArgs(process.argv)
  const name: string = args.length > 1 ? args[1] : "nish-prefork-jobs"
  const argv = process.argv
  const last: i32 = toI32(argv.length) - 1
  const flag: string = last >= 0 ? argv[last] : ""
  if (!flag.startsWith(PREFORK_WORKER_FLAG)) {
    return supervise(name)
  }
  const ran = tryPreforkWith(process.argv, new PreforkConfig())
  if (ran.isErr()) {
    console.error(`the workers: ${ran.error}`)
    return 1
  }
  const me: i32 = ran.value
  if (me > CLIENTS) {
    return 0
  }
  const opened = openRegion(name)
  if (opened.isErr()) {
    console.error(`the region: ${opened.error.message}`)
    return 1
  }
  return me === 0 ? owner(opened.value) : client(opened.value, me)
}
