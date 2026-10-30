// Work handed across cores without a socket: `nish/net/prefork` starts five
// worker processes, worker 0 owns a table of counters, and workers 1 to 4
// send it jobs ("add this to counter k") through one shared `MpscRing` and get
// each answer ("counter k is now v") back on an `SpscRing` of their own. All
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
import { getI32LE, getI64LE, setI32LE, setI64LE } from "nish/bytes"
import {
  PREFORK_WORKER_FLAG,
  PREFORK_WORKERS_EXITED,
  PreforkConfig,
  preforkArgs,
  preforkWith,
} from "nish/net/prefork"
import { monotonicNanos } from "nish:process"
import {
  attachMpscRing,
  attachSpscRing,
  initMpscRing,
  initSpscRing,
  MpscRing,
  mpscRingBytes,
  RING_EMPTY,
  SpscRing,
  spscRingBytes,
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
const ANSWER_RING: i32 = 1024
const WAIT_MS: i32 = 1000 // how long a worker waits on an empty ring
const answersAt = (worker: i32): i32 =>
  JOBS_AT + mpscRingBytes(JOB_SLOTS, JOB_BYTES) + (worker - 1) * spscRingBytes(ANSWER_RING)
const regionBytes = (): i32 => answersAt(CLIENTS + 1)

/** The next record, sleeping on the doorbell when there is none; polling off Linux. */
const takeJob = (ring: MpscRing, buf: u8[]): i32 => {
  const n: i32 = ring.popWait(buf, toI32(0), WAIT_MS)
  return n === SHM_UNSUPPORTED ? ring.tryPop(buf, toI32(0)) : n
}

const takeAnswer = (ring: SpscRing, buf: u8[]): i32 => {
  const n: i32 = ring.popWait(buf, toI32(0), WAIT_MS)
  return n === SHM_UNSUPPORTED ? ring.tryPop(buf, toI32(0)) : n
}

/** Worker 0: answers jobs until every client says it is done, or a second passes with none. */
const owner = (region: SharedRegion): void => {
  const jobs = attachMpscRing(region, JOBS_AT).expect("the job ring")
  const answers: SpscRing[] = []
  for (let c: i32 = 1; c <= CLIENTS; c++) {
    answers.push(attachSpscRing(region, answersAt(c)).expect("an answer ring"))
  }
  const counters: i64[] = new Array<i64>(COUNTERS)
  const job: u8[] = new Array<u8>(JOB_BYTES)
  const answer: u8[] = new Array<u8>(ANSWER_BYTES)
  let done: i32 = 0
  let answered: i64 = toI64(0)
  while (done < CLIENTS && takeJob(jobs, job) !== RING_EMPTY) {
    const client: i32 = getI32LE(job, 0)
    const counter: i32 = getI32LE(job, 8)
    if (counter < 0) {
      done = done + 1
      continue
    }
    if (client < 1 || client > CLIENTS || counter >= toI32(counters.length)) {
      continue
    }
    counters[counter] = counters[counter] + toI64(getI32LE(job, 12))
    setI32LE(answer, 0, getI32LE(job, 4))
    setI64LE(answer, 4, counters[counter])
    // The client never has more in flight than its ring holds.
    answers[client - 1].tryPush(answer, toI32(0), ANSWER_BYTES)
    answered = answered + 1
  }
  let total: i64 = toI64(0)
  for (const v of counters) {
    total = total + v
  }
  region.storeI64(ANSWERED_AT, answered, RELAXED)
  region.storeI64(TOTAL_AT, total, SEQ_CST)
}

/** Workers 1 to 4: job `seq` adds `seq` to counter `seq % COUNTERS`. */
const client = (region: SharedRegion, me: i32): void => {
  const jobs = attachMpscRing(region, JOBS_AT).expect("the job ring")
  const answers = attachSpscRing(region, answersAt(me)).expect("my answer ring")
  const job: u8[] = new Array<u8>(JOB_BYTES)
  const answer: u8[] = new Array<u8>(ANSWER_BYTES)
  setI32LE(job, 0, me)
  let sent: i32 = 1
  let got: i32 = 0
  let wrong: i32 = 0
  let since: i64 = monotonicNanos()
  while (got < JOBS) {
    while (sent <= JOBS && sent - 1 - got < WINDOW) {
      setI32LE(job, 4, sent)
      setI32LE(job, 8, sent % COUNTERS)
      setI32LE(job, 12, sent)
      if (!jobs.tryPush(job, toI32(0), JOB_BYTES)) {
        break
      }
      sent = sent + 1
    }
    if (sent - 1 === got) {
      // Nothing of ours in flight: the job ring is full of the others' jobs.
      if (monotonicNanos() - since > toI64(1000000000)) {
        break // a second without room: the owner is gone
      }
      continue
    }
    if (takeAnswer(answers, answer) === RING_EMPTY) {
      break // a second with no answer: the owner is gone
    }
    since = monotonicNanos()
    got = got + 1
    // Answers come back in order, and a counter only grows.
    if (getI32LE(answer, 0) !== got || getI64LE(answer, 4) < toI64(got)) {
      wrong = wrong + 1
    }
  }
  setI32LE(job, 8, -1)
  for (let k: i32 = 0; k < 1000000 && !jobs.tryPush(job, toI32(0), JOB_BYTES); k++) {
    // full: the owner is behind, so spin a while
  }
  region.addI32(FAILURES_AT, wrong + (JOBS - got), SEQ_CST)
}

/** The supervisor: makes the region and its rings, runs the workers, reports. */
const supervise = (name: string): i32 => {
  const stale = unlinkRegion(name) // left by a run that was killed, if any
  if (stale.isErr()) {
    // None: the usual case.
  }
  const region = createRegion(name, regionBytes()).expect("the region")
  initMpscRing(region, JOBS_AT, JOB_SLOTS, JOB_BYTES, true)
  for (let c: i32 = 1; c <= CLIENTS; c++) {
    initSpscRing(region, answersAt(c), ANSWER_RING, true)
  }
  const config = new PreforkConfig()
  config.workers = CLIENTS + 1
  config.restart = false
  const ended = preforkWith(process.argv, config)
  unlinkRegion(name).expect("unlink the region")
  const failures: i32 = region.loadI32(FAILURES_AT, SEQ_CST)
  const answered: i64 = region.loadI64(ANSWERED_AT, SEQ_CST)
  const total: i64 = region.loadI64(TOTAL_AT, SEQ_CST)
  console.log(`${CLIENTS} workers sent ${CLIENTS * JOBS} jobs; the owner answered ${answered}`)
  console.log(`the counters sum to ${total}; ${failures} answers were wrong or missing`)
  const want: i64 = (toI64(CLIENTS) * toI64(JOBS) * toI64(JOBS + 1)) / toI64(2)
  return ended === PREFORK_WORKERS_EXITED && failures === 0 && total === want ? 0 : 1
}

export const main = (): i32 => {
  const args = preforkArgs(process.argv)
  const name: string = args.length > 1 ? args[1] : "nish-prefork-jobs"
  const flag: string = process.argv.length > 0 ? process.argv[process.argv.length - 1] : ""
  if (!flag.startsWith(PREFORK_WORKER_FLAG)) {
    return supervise(name)
  }
  const me: i32 = preforkWith(process.argv, new PreforkConfig())
  if (me > CLIENTS) {
    return 0
  }
  const region = openRegion(name).expect("the region")
  if (me === 0) {
    owner(region)
  } else {
    client(region, me)
  }
  return 0
}
