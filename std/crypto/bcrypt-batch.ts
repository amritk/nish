/**
 * `nish/crypto/bcrypt-batch` — a login batcher: it queues bcrypt verifies and
 * hashes as they arrive, sends them as `bcryptVerifyN` / `bcryptHashN`
 * batches, and runs the batches on `std/threads` tasks, one per core.
 *
 *     import { bcryptCalibrate } from "nish/crypto/bcrypt"
 *     import { BcryptAnswer, BcryptBatcher, bcryptBatcher } from "nish/crypto/bcrypt-batch"
 *     import { availableParallelism, monotonicNanos } from "nish:process"
 *
 *     const noHold: i64 = 0
 *     const made = bcryptBatcher({ width: bcryptCalibrate(), holdNanos: noHold, cores: availableParallelism(), cost: 10 })
 *     const batcher: BcryptBatcher = made.value
 *     // In the server's loop, for each login that arrives:
 *     const ticket: i32 = batcher.verify(password, storedHash, monotonicNanos())
 *     // ... wait at most batcher.waitNanos(now) for the next readiness event, then:
 *     for (const a of batcher.run(monotonicNanos())) { reply(a.ticket, a.ok) }
 *
 * **Why.** How full a batch is moves the time per password by more than any
 * instruction-set work does: on one core a full six-lane cost-10 batch takes
 * 15.7 ms per hash and a lone hash 56.9 ms (docs/security/crypto-bcrypt.md,
 * "Speed"). A server whose logins arrive one at a time never fills a batch by
 * itself; this module holds them until there are enough, or until a short
 * window has passed.
 *
 * **When a batch is sent.** `run(now)` sends work when the queue holds at
 * least `width` requests, or when the oldest has waited `holdNanos`; a hold
 * of 0 sends whatever is queued at every `run`. It takes at most
 * `width × cores` requests a run, the oldest first, and spreads them evenly
 * over `min(cores, taken)` tasks, each running its share as one batch, so a
 * run takes about one batch's time and the event loop gets control back
 * between runs. Spreading rather than filling is deliberate: while a run is
 * going nothing else can use the free cores, and a batch of two on each of
 * three cores ends sooner than one of six on one. Under load the requests
 * that arrive during a run fill the next one, so the batches fill on their
 * own; at light load each request runs alone on a core, as a task per login
 * would. `waitNanos(now)` says how long the loop may sleep before a `run` is
 * due.
 *
 * **`run` blocks.** It opens a scope, runs the shares, one on the calling
 * thread, and returns once every share has finished: about one batch, 60–95
 * ms of cost 10 on the core this was measured on. That is the pause the
 * password-hashing guide describes for a scope on the event loop's thread;
 * give the batcher a thread of its own to avoid it.
 *
 * **On several cores, a batcher per process.** One batcher over every core
 * cannot start a run while one is going, so at light load a login waits for
 * the run in progress while cores sit idle. A prefork server with one process
 * a core, each with a batcher of `cores: 1`, overlaps the processes' runs:
 * measured, it matched a plain process per core at light load and one
 * batcher over every core under load (docs/security/crypto-bcrypt.md, "One
 * batcher per process").
 *
 * **The batcher keeps its own copy of each password.** `verify` and `hash`
 * borrow the caller's `Secret<u8[]>`, as any function taking one does: they
 * copy it, inside `exposeWith`, into a holder of the batcher's own (a class
 * with one `readonly` `Secret` field), and the caller wipes its password as
 * it would after `bcryptVerify`. `run` calls each copy's `wipe()` on the
 * calling thread once the scope that read it has joined, so no task can
 * still be reading it. A request that never runs (a batcher dropped with
 * requests queued) is not wiped: call `run` until `pending()` is 0 before
 * dropping one. The tasks call only `bcryptVerifyN`, `bcryptHashN` and
 * `bcryptVerify`, which wipe everything they make
 * (docs/security/crypto-bcrypt.md, BCRYPT-9, BCRYPT-11).
 *
 * **Every request gets its own answer.** A verify against a hash string that
 * is not one makes `bcryptVerifyN` an `Err` for the whole batch; the share
 * then verifies each of that batch's lanes alone, so only the damaged row
 * answers the `Err` and the rest answer as they would have. A `hash` whose
 * salt is not 16 bytes is answered with its `Err` at the next `run`, without
 * being batched. The answers of a run come back in the order their requests
 * were taken; match them to requests by `ticket`.
 *
 * Names carry the `bcryptBatch` prefix because a `std/` module's private
 * functions share the importing program's flat symbol namespace
 * (`docs/wp26-stdlib.md` §3e).
 */

import {
  BCRYPT_MAX_COST,
  BCRYPT_MIN_COST,
  bcryptHashN,
  bcryptVerify,
  bcryptVerifyN,
} from "nish/crypto/bcrypt"
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret"
import { scope } from "nish/threads"

/** A request's kind: a verify of a password against a stored hash. */
const BCRYPT_BATCH_VERIFY: i32 = 0

/** A request's kind: a new hash of a password under a salt. */
const BCRYPT_BATCH_HASH: i32 = 1

/** The most lanes `bcryptVerifyN` and `bcryptHashN` take. */
const BCRYPT_BATCH_MAX_WIDTH: i32 = 6

/** How a batcher sends its work: see `bcryptBatcher`. */
export interface BcryptBatchConfig {
  /** Lanes per batch, 1 to 6: `bcryptCalibrate()`'s answer. */
  width: i32
  /** How long the oldest request may wait for a batch to fill, in nanoseconds; 0 never waits. */
  holdNanos: i64
  /** How many tasks a run may use, at least 1: `availableParallelism()`. */
  cores: i32
  /** The cost `hash` requests are made at, 4 to 31. Verifies take theirs from the hash. */
  cost: i32
}

/** What a request answered, under the ticket `verify` or `hash` gave it. */
export class BcryptAnswer {
  /** The ticket of the request. */
  ticket: i32
  /** A verify: whether the password is the hash's. A hash: whether it was made. False with an error. */
  ok: boolean
  /** A hash request's `$2b$` hash; "" for a verify and for an error. */
  hash: string
  /** "" unless the request is an `Err`, as `bcryptVerify` or `bcryptHash` words it. */
  error: string

  /**
   * Holds one answer as given; `run` makes these.
   *
   * @param ticket The ticket of the request answered.
   * @param ok The answer: the password matched, or the hash was made.
   * @param hash The `$2b$` hash a hash request made, or "".
   * @param error The `Err`'s text, or "" for none.
   */
  constructor(ticket: i32, ok: boolean, hash: string, error: string) {
    this.ticket = ticket
    this.ok = ok
    this.hash = hash
    this.error = error
  }
}

/**
 * The batcher's copy of one queued password: a holder, so it may sit in the
 * queue's array, made at the password's length and filled by `bcryptBatchTake`.
 */
class BcryptBatchKey {
  /** @internal Read by this module's batch functions; the class is not exported. */
  readonly key: Secret<u8[]>

  constructor(length: i32) {
    this.key = secret(new Array<u8>(length))
  }

  /** @internal Called by `BcryptBatcher.run`; the class is not exported. */
  wipe(): void {
    wipe(this.key)
  }
}

/** A password's length, the one fact about it the batcher reads outside a batch. */
const bcryptBatchLengthOf = (bytes: u8[]): i32 => toI32(bytes.length)

/** Copies `from` into the exposed key `into`, which has its length. */
const bcryptBatchCopy = (into: u8[], from: u8[]): i32 => {
  for (let i: i32 = 0; i < toI32(into.length) && i < toI32(from.length); i++) {
    into[i] = from[i]
  }
  return 0
}

/** Copies the exposed password `bytes` into `held`'s key. */
const bcryptBatchFill = (bytes: u8[], held: BcryptBatchKey): i32 =>
  exposeWith(held.key, bytes, bcryptBatchCopy)

/** A new holder with a copy of `password`; the caller keeps, and wipes, its own. */
const bcryptBatchTake = (password: Secret<u8[]>): BcryptBatchKey => {
  const held: BcryptBatchKey = new BcryptBatchKey(expose(password, bcryptBatchLengthOf))
  exposeWith(password, held, bcryptBatchFill)
  return held
}

/**
 * One task's work: requests in the order the share takes them. The task
 * reads it and writes none of it; its answer is one string a request, "1"
 * or "0" for a verify, the hash for a hash, and "!" and the error for an
 * `Err`.
 */
class BcryptBatchShare {
  /** @internal Read by this module's task functions; the class is not exported. */
  passwords: BcryptBatchKey[]
  /** @internal Read by this module's task functions; the class is not exported. */
  kinds: i32[]
  /**
   * A verify's stored hash, "" for a hash.
   *
   * @internal Read by this module's task functions; the class is not exported.
   */
  hashes: string[]
  /**
   * 16 bytes a request; a verify's are zeros and are not read.
   *
   * @internal Read by this module's task functions; the class is not exported.
   */
  salts: u8[]
  /** @internal Read by this module's task functions; the class is not exported. */
  cost: i32
  /** @internal Read by this module's task functions; the class is not exported. */
  width: i32

  constructor(cost: i32, width: i32) {
    this.passwords = []
    this.kinds = []
    this.hashes = []
    this.salts = []
    this.cost = cost
    this.width = width
  }
}

/** The holder at `list[i]` of `share`, or at `list[0]` past the batch's end (that lane is then passed as null). */
const bcryptBatchLane = (share: BcryptBatchShare, list: i32[], i: i32): BcryptBatchKey => {
  const at: i32 = i < toI32(list.length) ? list[i] : list[0]
  return share.passwords[at]
}

/** The answer string of one verify alone, for a lane of a batch that answered an `Err`. */
const bcryptBatchVerifyAlone = (held: BcryptBatchKey, hash: string): string => {
  const said: Result<boolean, string> = bcryptVerify(held.key, hash)
  if (said.isErr()) {
    return `!${said.error}`
  }
  return said.value ? "1" : "0"
}

/**
 * One `bcryptVerifyN` over the first `n` of `list`: a holder's field is
 * passed only as a call's argument, so each lane count is its own call.
 */
const bcryptBatchVerifyLanes = (
  share: BcryptBatchShare,
  list: i32[],
  n: i32,
  hashes: string[]
): Result<boolean[], string> => {
  const a: BcryptBatchKey = bcryptBatchLane(share, list, 0)
  const b: BcryptBatchKey = bcryptBatchLane(share, list, 1)
  const c: BcryptBatchKey = bcryptBatchLane(share, list, 2)
  const d: BcryptBatchKey = bcryptBatchLane(share, list, 3)
  const e: BcryptBatchKey = bcryptBatchLane(share, list, 4)
  const f: BcryptBatchKey = bcryptBatchLane(share, list, 5)
  if (n <= 1) {
    return bcryptVerifyN(a.key, null, null, null, null, null, hashes)
  }
  if (n === 2) {
    return bcryptVerifyN(a.key, b.key, null, null, null, null, hashes)
  }
  if (n === 3) {
    return bcryptVerifyN(a.key, b.key, c.key, null, null, null, hashes)
  }
  if (n === 4) {
    return bcryptVerifyN(a.key, b.key, c.key, d.key, null, null, hashes)
  }
  if (n === 5) {
    return bcryptVerifyN(a.key, b.key, c.key, d.key, e.key, null, hashes)
  }
  return bcryptVerifyN(a.key, b.key, c.key, d.key, e.key, f.key, hashes)
}

/** One `bcryptHashN` over the first `n` of `list`, as `bcryptBatchVerifyLanes` is for verifies. */
const bcryptBatchHashLanes = (
  share: BcryptBatchShare,
  list: i32[],
  n: i32,
  salts: u8[]
): Result<string[], string> => {
  const a: BcryptBatchKey = bcryptBatchLane(share, list, 0)
  const b: BcryptBatchKey = bcryptBatchLane(share, list, 1)
  const c: BcryptBatchKey = bcryptBatchLane(share, list, 2)
  const d: BcryptBatchKey = bcryptBatchLane(share, list, 3)
  const e: BcryptBatchKey = bcryptBatchLane(share, list, 4)
  const f: BcryptBatchKey = bcryptBatchLane(share, list, 5)
  if (n <= 1) {
    return bcryptHashN(a.key, null, null, null, null, null, salts, share.cost)
  }
  if (n === 2) {
    return bcryptHashN(a.key, b.key, null, null, null, null, salts, share.cost)
  }
  if (n === 3) {
    return bcryptHashN(a.key, b.key, c.key, null, null, null, salts, share.cost)
  }
  if (n === 4) {
    return bcryptHashN(a.key, b.key, c.key, d.key, null, null, salts, share.cost)
  }
  if (n === 5) {
    return bcryptHashN(a.key, b.key, c.key, d.key, e.key, null, salts, share.cost)
  }
  return bcryptHashN(a.key, b.key, c.key, d.key, e.key, f.key, salts, share.cost)
}

/** The verifies of `share` at `list[from..from + n)` as one `bcryptVerifyN`, each lane's answer into `out` at its index. */
const bcryptBatchVerifyRun = (
  share: BcryptBatchShare,
  list: i32[],
  from: i32,
  n: i32,
  out: string[]
): void => {
  const lanes: i32[] = []
  for (let i: i32 = from; i < from + n && i < toI32(list.length); i++) {
    if (i >= 0) {
      lanes.push(list[i])
    }
  }
  if (toI32(lanes.length) === 0) {
    return
  }
  const hashes: string[] = ["", "", "", "", "", ""]
  for (let s: i32 = 0; s < toI32(lanes.length) && s < 6; s++) {
    const at: i32 = lanes[s]
    if (at >= 0 && at < toI32(share.hashes.length)) {
      hashes[s] = share.hashes[at]
    }
  }
  const said: Result<boolean[], string> = bcryptBatchVerifyLanes(share, lanes, toI32(lanes.length), hashes)
  for (let s: i32 = 0; s < toI32(lanes.length); s++) {
    const at: i32 = lanes[s]
    let line: string = "0"
    if (said.isErr()) {
      // One damaged hash fails the whole call: answer each lane alone.
      if (at >= 0 && at < toI32(share.passwords.length) && s < toI32(hashes.length)) {
        line = bcryptBatchVerifyAlone(share.passwords[at], hashes[s])
      }
    } else {
      const ok: boolean[] = said.value
      line = s < toI32(ok.length) && ok[s] ? "1" : "0"
    }
    if (at >= 0 && at < toI32(out.length)) {
      out[at] = line
    }
  }
}

/** The hashes of `share` at `list[from..from + n)` as one `bcryptHashN`, each lane's answer into `out` at its index. */
const bcryptBatchHashRun = (share: BcryptBatchShare, list: i32[], from: i32, n: i32, out: string[]): void => {
  const lanes: i32[] = []
  for (let i: i32 = from; i < from + n && i < toI32(list.length); i++) {
    if (i >= 0) {
      lanes.push(list[i])
    }
  }
  if (toI32(lanes.length) === 0) {
    return
  }
  const salts: u8[] = new Array<u8>(96)
  for (let s: i32 = 0; s < toI32(lanes.length) && s < 6; s++) {
    const at: i32 = lanes[s]
    for (let j: i32 = 0; j < 16 && 16 * at + j < toI32(share.salts.length); j++) {
      if (at >= 0) {
        salts[16 * s + j] = share.salts[16 * at + j]
      }
    }
  }
  const made: Result<string[], string> = bcryptBatchHashLanes(share, lanes, toI32(lanes.length), salts)
  for (let s: i32 = 0; s < toI32(lanes.length); s++) {
    const at: i32 = lanes[s]
    let line: string = ""
    if (made.isErr()) {
      line = `!${made.error}`
    } else {
      const all: string[] = made.value
      line = s < toI32(all.length) ? all[s] : ""
    }
    if (at >= 0 && at < toI32(out.length)) {
      out[at] = line
    }
  }
}

/** The indices of `share`'s requests of `kind`, in order. */
const bcryptBatchOfKind = (share: BcryptBatchShare, kind: i32): i32[] => {
  const list: i32[] = []
  for (let i: i32 = 0; i < toI32(share.kinds.length); i++) {
    if (share.kinds[i] === kind) {
      list.push(i)
    }
  }
  return list
}

/**
 * One task: every request of `share`, the verifies and then the hashes, in
 * batches of up to `width`. It reads `share` and writes only arrays it made,
 * and answers one line a request, joined by "\n": a task hands back a string,
 * not an array of them. No answer holds a newline: a `$2b$` hash is base-64
 * and bcrypt's errors are one line.
 */
const bcryptBatchShareRun = (share: BcryptBatchShare): string => {
  const out: string[] = []
  for (let i: i32 = 0; i < toI32(share.kinds.length); i++) {
    out.push("")
  }
  const width: i32 = share.width < 1 ? 1 : share.width
  const verifies: i32[] = bcryptBatchOfKind(share, BCRYPT_BATCH_VERIFY)
  for (let i: i32 = 0; i < toI32(verifies.length); i += width) {
    bcryptBatchVerifyRun(share, verifies, i, width, out)
  }
  const hashes: i32[] = bcryptBatchOfKind(share, BCRYPT_BATCH_HASH)
  for (let i: i32 = 0; i < toI32(hashes.length); i += width) {
    bcryptBatchHashRun(share, hashes, i, width, out)
  }
  return out.join("\n")
}

/**
 * The cost a verify's stored hash names, read from its fourth and fifth
 * characters, or -1 when they are not two digits; only the order of a run
 * reads it, so that one cost's verifies share a batch.
 */
const bcryptBatchCostOf = (hash: string): i32 => {
  if (toI32(hash.length) < 7) {
    return -1
  }
  const tens: i32 = toI32(hash.charCodeAt(4)) - 48
  const ones: i32 = toI32(hash.charCodeAt(5)) - 48
  if (tens < 0 || tens > 9 || ones < 0 || ones > 9) {
    return -1
  }
  return tens * 10 + ones
}

/** The lines of a task's answer, split at "\n". */
const bcryptBatchLines = (joined: string): string[] => {
  const lines: string[] = []
  let from: i32 = 0
  while (from >= 0 && from <= toI32(joined.length)) {
    const at: i32 = toI32(joined.indexOf("\n", from))
    if (at < from || at > toI32(joined.length)) {
      lines.push(joined.slice(from))
      return lines
    }
    lines.push(joined.slice(from, at))
    from = at + 1
  }
  return lines
}

/** The answer a share's string stands for. */
const bcryptBatchAnswerOf = (ticket: i32, kind: i32, said: string): BcryptAnswer => {
  if (said.startsWith("!")) {
    return new BcryptAnswer(ticket, false, "", said.substring(1))
  }
  if (kind === BCRYPT_BATCH_HASH) {
    return new BcryptAnswer(ticket, said !== "", said, "")
  }
  return new BcryptAnswer(ticket, said === "1", "", "")
}

/**
 * A queue of bcrypt requests and the policy that sends them: made by
 * `bcryptBatcher`. `verify` and `hash` queue, `run` sends and answers,
 * `waitNanos` says when the next `run` is due.
 */
export class BcryptBatcher {
  private holdNanos: i64
  /** The queue, from `head`: each request's copy of its password, kind, stored hash, salt (16 bytes each), ticket and arrival. */
  private passwords: BcryptBatchKey[]
  private kinds: i32[]
  private hashes: string[]
  private salts: u8[]
  private tickets: i32[]
  private arrived: i64[]
  /** Answers made without a batch (a salt of the wrong length), handed out by the next `run`. */
  private early: BcryptAnswer[]
  private width: i32
  private cores: i32
  private cost: i32
  private head: i32
  /** The next ticket. */
  private next: i32

  /**
   * Takes `config` as it is and starts an empty queue. `bcryptBatcher` checks
   * the config first; make batchers with it.
   *
   * @param config The policy; its fields are kept, not checked.
   */
  constructor(config: BcryptBatchConfig) {
    this.width = config.width
    this.holdNanos = config.holdNanos
    this.cores = config.cores
    this.cost = config.cost
    this.passwords = []
    this.kinds = []
    this.hashes = []
    this.salts = []
    this.tickets = []
    this.arrived = []
    this.head = 0
    this.early = []
    this.next = 0
  }

  /**
   * How many requests are queued or answered and not yet handed out by `run`.
   *
   * @returns The count of requests not yet answered by `run`.
   */
  pending(): i32 {
    return toI32(this.kinds.length) - this.head + toI32(this.early.length)
  }

  /**
   * Queues a verify of `password` against `hash`, which arrived at `now`
   * (`monotonicNanos()`), and answers its ticket. The batcher queues a copy
   * of `password` and wipes the copy once the verify has run; the caller
   * wipes its own.
   *
   * @param password The password to check; the batcher copies it, and the
   *   caller still owns and wipes it.
   * @param hash The stored hash; its cost sets the work, so it must be one you
   *   stored.
   * @param now The time of the call, from `monotonicNanos()`.
   * @returns The ticket its `BcryptAnswer` will carry.
   */
  verify(password: Secret<u8[]>, hash: string, now: i64): i32 {
    const ticket: i32 = this.next
    this.next = this.next + 1
    this.enqueue(password, BCRYPT_BATCH_VERIFY, hash, new Array<u8>(16), ticket, now)
    return ticket
  }

  /**
   * Queues a new hash of `password` under `salt` (16 bytes, fresh from
   * `crypto.getRandomValues`) at the batcher's cost, which arrived at `now`,
   * and answers its ticket. The batcher queues a copy of `password` and
   * wipes the copy once the hash is made; a salt of another length is
   * answered with its `Err` by the next `run`, and no copy is made.
   *
   * @param password The password to hash; the batcher copies it unless the salt
   *   is bad, and the caller still owns and wipes it.
   * @param salt 16 fresh random bytes; it is copied.
   * @param now The time of the call, from `monotonicNanos()`.
   * @returns The ticket its `BcryptAnswer` will carry.
   */
  hash(password: Secret<u8[]>, salt: u8[], now: i64): i32 {
    const ticket: i32 = this.next
    this.next = this.next + 1
    if (toI32(salt.length) !== 16) {
      this.early.push(new BcryptAnswer(ticket, false, "", "bcrypt: the salt is not 16 bytes"))
      return ticket
    }
    this.enqueue(password, BCRYPT_BATCH_HASH, "", salt, ticket, now)
    return ticket
  }

  /** Appends one request to the queue. */
  private enqueue(password: Secret<u8[]>, kind: i32, hash: string, salt: u8[], ticket: i32, now: i64): void {
    this.passwords.push(bcryptBatchTake(password))
    this.kinds.push(kind)
    this.hashes.push(hash)
    for (let j: i32 = 0; j < 16 && j < toI32(salt.length); j++) {
      this.salts.push(salt[j])
    }
    this.tickets.push(ticket)
    this.arrived.push(now)
  }

  /**
   * Nanoseconds from `now` until a `run` is due: 0 when it is due now (a full
   * batch is queued, the oldest request has waited `holdNanos`, or an answer
   * is waiting), -1 when nothing is queued.
   *
   * @param now The time of the call, from `monotonicNanos()`.
   * @returns How many nanoseconds the loop may wait before the next `run`: 0
   *   for now, -1 for no work.
   */
  waitNanos(now: i64): i64 {
    if (toI32(this.early.length) > 0) {
      return 0
    }
    const queued: i32 = toI32(this.kinds.length) - this.head
    if (queued <= 0) {
      return -1
    }
    if (queued >= this.width || this.head >= toI32(this.arrived.length)) {
      return 0
    }
    const waited: i64 = now - this.arrived[this.head]
    return waited >= this.holdNanos ? 0 : this.holdNanos - waited
  }

  /**
   * Sends what is due and answers it: nothing (bar answers made without a
   * batch) until `waitNanos(now)` is 0, then up to `width × cores` of the
   * oldest requests, spread evenly over up to `cores` tasks, each running
   * its share as batches of up to `width`. Returns once every task has
   * finished, with the copy of each password it ran wiped.
   *
   * @param now The time of the call, from `monotonicNanos()`.
   * @returns A fresh array of the answers this call made, possibly empty, in
   *   the order their requests were taken.
   */
  run(now: i64): BcryptAnswer[] {
    const answers: BcryptAnswer[] = []
    for (const a of this.early) {
      answers.push(a)
    }
    this.early = []
    if (this.waitNanos(now) !== 0) {
      return answers
    }
    const queued: i32 = toI32(this.kinds.length) - this.head
    if (queued <= 0) {
      return answers
    }
    const most: i32 = this.width * this.cores
    const taken: i32 = queued < most ? queued : most
    const order: i32[] = this.orderOf(taken)
    const tasks: i32 = taken < this.cores ? taken : this.cores
    const shares: BcryptBatchShare[] = []
    // Share k takes order[taken·k/tasks, taken·(k+1)/tasks): contiguous, so one cost's verifies stay together.
    const owner: i32[] = []
    for (let k: i32 = 0; k < tasks; k++) {
      const share: BcryptBatchShare = new BcryptBatchShare(this.cost, this.width)
      const lo: i32 = (taken * k) / tasks
      const hi: i32 = (taken * (k + 1)) / tasks
      for (let i: i32 = lo; i >= 0 && i < hi && i < toI32(order.length); i++) {
        const at: i32 = order[i]
        if (at >= 0 && at < toI32(this.passwords.length) && at < toI32(this.kinds.length)) {
          share.passwords.push(this.passwords[at])
          share.kinds.push(this.kinds[at])
          share.hashes.push(at < toI32(this.hashes.length) ? this.hashes[at] : "")
          for (let j: i32 = 0; j < 16; j++) {
            share.salts.push(16 * at + j < toI32(this.salts.length) ? this.salts[16 * at + j] : toU8(0))
          }
          owner.push(at)
        }
      }
      shares.push(share)
    }
    const said: string[] = []
    for (let k: i32 = 0; k < tasks; k++) {
      said.push("")
    }
    {
      using s = scope()
      for (let k: i32 = 0; k < toI32(shares.length); k++) {
        s.spawn(bcryptBatchShareRun, shares[k], said, k)
      }
    }
    let flat: i32 = 0
    for (let k: i32 = 0; k < toI32(said.length); k++) {
      const one: string[] = bcryptBatchLines(said[k])
      for (let i: i32 = 0; i < toI32(one.length) && flat < toI32(owner.length); i++) {
        const at: i32 = owner[flat]
        flat++
        if (at >= 0 && at < toI32(this.tickets.length) && at < toI32(this.kinds.length)) {
          answers.push(bcryptBatchAnswerOf(this.tickets[at], this.kinds[at], one[i]))
        }
      }
    }
    for (const at of order) {
      if (at >= 0 && at < toI32(this.passwords.length)) {
        const held: BcryptBatchKey = this.passwords[at]
        held.wipe()
      }
    }
    this.head = this.head + taken
    this.compact()
    return answers
  }

  /**
   * The queue indices of the `taken` oldest requests, verifies by the cost
   * their hash names and then hashes, each group in arrival order.
   */
  private orderOf(taken: i32): i32[] {
    const keyed: i32[] = []
    const keys: i32[] = []
    for (let i: i32 = this.head; i < this.head + taken && i < toI32(this.kinds.length); i++) {
      keyed.push(i)
      let key: i32 = 1000
      if (this.kinds[i] !== BCRYPT_BATCH_HASH) {
        key = i < toI32(this.hashes.length) ? bcryptBatchCostOf(this.hashes[i]) : -1
      }
      keys.push(key)
    }
    // Stable: one pass a distinct key, lowest first, each in arrival order.
    // A run takes at most 36 requests, of a few costs.
    const sorted: i32[] = []
    let last: i32 = -2
    while (toI32(sorted.length) < toI32(keyed.length)) {
      let low: i32 = 1001
      for (const key of keys) {
        if (key > last && key < low) {
          low = key
        }
      }
      if (low > 1000) {
        return sorted
      }
      for (let i: i32 = 0; i < toI32(keyed.length) && i < toI32(keys.length); i++) {
        if (keys[i] === low) {
          sorted.push(keyed[i])
        }
      }
      last = low
    }
    return sorted
  }

  /** Drops the requests before `head` once they are most of the queue, so a long-lived batcher's arrays stay small. */
  private compact(): void {
    if (this.head < 64 || this.head * 2 < toI32(this.kinds.length)) {
      return
    }
    const passwords: BcryptBatchKey[] = []
    const kinds: i32[] = []
    const hashes: string[] = []
    const salts: u8[] = []
    const tickets: i32[] = []
    const arrived: i64[] = []
    for (let i: i32 = this.head; i < toI32(this.kinds.length); i++) {
      if (
        i < toI32(this.passwords.length) &&
        i < toI32(this.hashes.length) &&
        i < toI32(this.tickets.length) &&
        i < toI32(this.arrived.length)
      ) {
        passwords.push(this.passwords[i])
        kinds.push(this.kinds[i])
        hashes.push(this.hashes[i])
        for (let j: i32 = 0; j < 16; j++) {
          salts.push(16 * i + j < toI32(this.salts.length) ? this.salts[16 * i + j] : toU8(0))
        }
        tickets.push(this.tickets[i])
        arrived.push(this.arrived[i])
      }
    }
    this.passwords = passwords
    this.kinds = kinds
    this.hashes = hashes
    this.salts = salts
    this.tickets = tickets
    this.arrived = arrived
    this.head = 0
  }
}

/**
 * A new batcher for `config`, or an `Err` naming the field out of range: a
 * width outside 1 to 6, a negative hold, fewer than one core, or a cost
 * outside 4 to 31.
 *
 * @param config The policy: width, hold, cores and cost.
 * @returns A new, empty batcher, or an `Err` naming the field out of range.
 */
export const bcryptBatcher = (config: BcryptBatchConfig): Result<BcryptBatcher, string> => {
  if (config.width < 1 || config.width > BCRYPT_BATCH_MAX_WIDTH) {
    return Err("bcrypt: the batch width is outside 1 to 6")
  }
  if (config.holdNanos < 0) {
    return Err("bcrypt: the hold is negative")
  }
  if (config.cores < 1) {
    return Err("bcrypt: a batcher needs at least one core")
  }
  if (config.cost < BCRYPT_MIN_COST || config.cost > BCRYPT_MAX_COST) {
    return Err("bcrypt: the cost is outside 4 to 31")
  }
  return Ok(new BcryptBatcher(config))
}
