// The login server of bench/crypto/bcrypt/batcher.mjs. `n` logins of "U*U"
// against `hash` arrive on a seeded Poisson schedule at `rate` a second (0:
// all at once), the first at `start` on CLOCK_MONOTONIC, and are answered by
//   a  one `bcryptVerify` per login on this process's one thread, for the
//      logins i with i % workers === worker; the harness runs one process
//      for (a), and one a core for (b), as a prefork server would (a
//      scope's task cannot read the clock, so (b) is processes);
//   c  `nish/crypto/bcrypt-batch` at `bcryptCalibrate()`'s width over
//      `cores` tasks, holding a part batch up to `hold` microseconds.
// A login that has arrived while its server is busy waits; an idle server
// spins on the clock until its next login arrives. It prints `done` and the
// clock when its last answer was made, then `i ns` for each login it
// answered: its index and its latency, from arrival to answer, in
// nanoseconds. It exits 1 if a login was refused.
//
// `login hash` prints the cost-10 hash of "U*U" under an all-zero salt.
//
// Usage: login <a|c> <cores> <rate> <n> <seed> <hold-us> <start-s> <start-ns> <worker> <workers> <hash>
import { bcryptCalibrate, bcryptHash, bcryptVerify } from "nish/crypto/bcrypt"
import { BcryptAnswer, BcryptBatchConfig, BcryptBatcher, bcryptBatcher } from "nish/crypto/bcrypt-batch"
import { Secret, secret, wipe } from "nish:secret"
import { monotonicNanos } from "nish:process"

/** `n` arrival offsets in nanoseconds, the first 0, exponential gaps at `rate` a second from an LCG seeded with `seed`; all 0 for rate 0. */
const arrivals = (n: i32, rate: i32, seed: i32): i64[] => {
  const out: i64[] = []
  let state: i64 = toI64(seed) % 2147483648
  let t: f64 = 0.0
  for (let i: i32 = 0; i < n; i++) {
    out.push(toI64(t))
    if (rate > 0) {
      state = (state * 1103515245 + 12345) % 2147483648
      const u: f64 = (toF64(state) + 1.0) / 2147483649.0
      t = t - (Math.log(u) / toF64(rate)) * 1000000000.0
    }
  }
  return out
}

/** The password a login sends, as a fresh `Secret`. */
const sent = (): Secret<u8[]> => {
  const raw: u8[] = [85, 42, 85]
  return secret(raw)
}

/** Spins until the clock reaches `t`. */
const spinUntil = (t: i64): void => {
  let now: i64 = monotonicNanos()
  while (now < t) {
    now = monotonicNanos()
  }
}

/** Modes a and b: this worker's logins one at a time; the refused count. */
const direct = (arrive: i64[], start: i64, hash: string, worker: i32, workers: i32): i32 => {
  let refused: i32 = 0
  let last: i64 = start
  const lines: string[] = []
  for (let i: i32 = worker; i >= 0 && i < arrive.length; i += workers) {
    const at: i64 = start + arrive[i]
    spinUntil(at)
    const pw: Secret<u8[]> = sent()
    const said: Result<boolean, string> = bcryptVerify(pw, hash)
    wipe(pw)
    if (!(said.isOk() && said.value)) {
      refused++
    }
    last = monotonicNanos()
    lines.push(`${i} ${last - at}`)
  }
  console.log(`done ${last}`)
  console.log(lines.join("\n"))
  return refused
}

/** Mode c: queue each login as it arrives and run the batcher whenever a batch is due; the refused count. */
const batched = (arrive: i64[], start: i64, hash: string, b: BcryptBatcher): i32 => {
  const n: i32 = toI32(arrive.length)
  const lat: i64[] = new Array<i64>(n)
  let queued: i32 = 0
  let answered: i32 = 0
  let refused: i32 = 0
  let last: i64 = start
  spinUntil(start)
  while (answered < n) {
    const now: i64 = monotonicNanos()
    while (queued >= 0 && queued < arrive.length && start + arrive[queued] <= now) {
      const pw: Secret<u8[]> = sent()
      b.verify(pw, hash, start + arrive[queued])
      wipe(pw)
      queued++
    }
    if (b.pending() > 0 && b.waitNanos(now) === 0) {
      const answers: BcryptAnswer[] = b.run(now)
      last = monotonicNanos()
      for (const a of answers) {
        if (!a.ok) {
          refused++
        }
        const i: i32 = a.ticket
        if (i >= 0 && i < lat.length && i < arrive.length) {
          lat[i] = last - (start + arrive[i])
        }
        answered++
      }
    }
  }
  const lines: string[] = []
  for (let i: i32 = 0; i < lat.length; i++) {
    lines.push(`${i} ${lat[i]}`)
  }
  console.log(`done ${last}`)
  console.log(lines.join("\n"))
  return refused
}

export const main = (): i32 => {
  if (process.argv.length === 2 && process.argv[1] === "hash") {
    const pw: Secret<u8[]> = sent()
    const made: Result<string, string> = bcryptHash(pw, new Array<u8>(16), 10)
    wipe(pw)
    console.log(made.isOk() ? made.value : made.error)
    return made.isOk() ? 0 : 1
  }
  if (process.argv.length < 12) {
    console.log(
      "usage: login <a|c> <cores> <rate> <n> <seed> <hold-us> <start-s> <start-ns> <worker> <workers> <hash>"
    )
    return 2
  }
  const mode: string = process.argv[1]
  const cores: i32 = parseInt(process.argv[2])
  const arrive: i64[] = arrivals(
    parseInt(process.argv[4]),
    parseInt(process.argv[3]),
    parseInt(process.argv[5])
  )
  const holdUs: i32 = parseInt(process.argv[6])
  const start: i64 = toI64(parseInt(process.argv[7])) * 1000000000 + toI64(parseInt(process.argv[8]))
  const hash: string = process.argv[11]
  if (mode === "a") {
    return direct(arrive, start, hash, parseInt(process.argv[9]), parseInt(process.argv[10])) === 0 ? 0 : 1
  }
  const config: BcryptBatchConfig = {
    width: bcryptCalibrate(),
    holdNanos: toI64(holdUs) * 1000,
    cores: cores,
    cost: 10,
  }
  const b: Result<BcryptBatcher, string> = bcryptBatcher(config)
  if (b.isErr()) {
    console.log(b.error)
    return 1
  }
  return batched(arrive, start, hash, b.value) === 0 ? 0 : 1
}
