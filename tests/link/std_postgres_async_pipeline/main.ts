// Statements from many tasks pipelined on one `PgAsyncPool` connection
// (pgAsyncPrepare, pgAsyncSeat, pgAsyncSend, pgAsyncTurn, pgAsyncAnswer,
// pgAsyncDone), against the
// stand-in backend of ../std_postgres_async/server.ts:
//
//   1. In flight together: `gate` is answered only once five `echo`s seated
//      behind it on the one connection have been sent, so the gate's answer
//      proves all six were in flight at once; each echo gets its own value
//      back, in order, and `echo` was parsed once for the five.
//   2. A failure mid-batch: a Parse the server refuses (42601) fails its own
//      statement; the one seated behind it on the same statement, sent with
//      no Parse, fails 26000; an `echo` with a NUL is not sent and fails
//      PG_ERR_ENCODING, handing its place in the order back; an `echo` behind
//      them all is answered; the connection is still served, and the
//      statement parses again next time.
//   3. Past the input: a 20,000-byte row, more than the pool's input holds,
//      seated behind a gate with an `echo` behind it, is read whole, and the
//      echo after it.
//   4. The wake: with `depth` 1 and the seat held by `wait`, a second seat
//      waits once and is woken by the first's answer, not by a clock.
//   4b. No barging: with `depth` 1 and the seat held by `wait`, a task
//      parks for a seat; the holder, done, asks for another at once, before
//      the parked task has run, and queues behind it rather than take the
//      seat back, so the parked task is answered first.
//   4c. A crowd: with `depth` 1 and the seat held, 150 tasks queue for it,
//      more than the runtime reports ready in one turn; each is woken in
//      its turn, and all 150 are answered, none timed out.
//   5. A bounded wait: the same with `claimWaitMs` at 30 answers -2 after one
//      wait.
//   6. Cancelled with its answer unread: the task's answer fails with
//      socketError PG_ASYNC_CANCELLED, the statement seated behind it fails
//      PG_ERR_CLOSED, and the connection, out of step, is closed once both
//      are answered.
//   7. Lost mid-pipeline: a connection that ends under `die` fails it and the
//      statement behind it with PG_ERR_CLOSED and is closed.
//   8. Hostile mid-pipeline: a frame past `maxMessage` fails `big` with
//      PG_ERR_TOO_BIG; the connection, out of step, fails the statement
//      behind it with PG_ERR_CLOSED and is closed.
import { cancel, sleep, spawn, taskId } from "nish:async"
import { netLocalPort, tcpListen } from "nish:net"
import { secret, wipe } from "nish:secret"
import { PgConfig, pgTarget } from "nish/net/postgres"
import {
  PgAsyncParams,
  PgAsyncPool,
  PgAsyncResult,
  pgAsyncAnswer,
  pgAsyncConnect,
  pgAsyncDone,
  pgAsyncPrepare,
  pgAsyncSeat,
  pgAsyncSend,
  pgAsyncTurn,
} from "nish/net/postgres-async"
import { Board, backend } from "../std_postgres_async/server"

/** Each cancellable task's handle, for `main` to cancel. */
class Handles {
  task: i64 = 0
}

/** A line describing `r`. */
const describe = (label: string, r: PgAsyncResult): string => {
  const text: string = r.rows > 0 && r.columns > 0 ? r.text(r.rows - 1, 0) : ""
  const cell: string = text.length > 20 ? `${text.length} bytes` : text
  const code: string = r.errorCode.length > 0 ? ` error=${r.errorCode}` : ""
  return `${label}: ok=${r.ok()} failure=${r.failure} socket=${r.socketError} rows=${r.rows} reusable=${r.reusable} first=${cell}${code}`
}

/** Seats `statement`, sends it with `arg` (none when empty), counts it sent, prints its answer and counts itself done. */
async function pipe(pool: PgAsyncPool, board: Board, handles: Handles, statement: i32, arg: string, label: string): Promise<void> {
  handles.task = taskId()
  const ticket: i32 = await pgAsyncSeat(pool, statement)
  if (ticket < 0) {
    console.log(`${label}: no seat (${ticket})`)
    board.done += 1
    return
  }
  const params = new PgAsyncParams()
  if (arg.length > 0) {
    params.text(arg)
  }
  const sent: i32 = await pgAsyncSend(pool, ticket, params)
  board.sent += 1
  const turn: i32 = await pgAsyncTurn(pool, ticket, sent)
  const r = await pgAsyncAnswer(pool, ticket, turn)
  pgAsyncDone(pool, ticket, turn, r.reusable)
  console.log(describe(label, r))
  if (label === "gate") {
    console.log(`sent before the gate was answered: ${board.sent}`)
  }
  board.done += 1
}

/** Runs `first`, then at once seats `then` and runs it, printing each answer and counting each done. */
async function again(pool: PgAsyncPool, board: Board, first: i32, then: i32): Promise<void> {
  let statement: i32 = first
  for (let i: i32 = 0; i < 2; i++) {
    const ticket: i32 = await pgAsyncSeat(pool, statement)
    const sent: i32 = await pgAsyncSend(pool, ticket, new PgAsyncParams())
    const turn: i32 = await pgAsyncTurn(pool, ticket, sent)
    const r = await pgAsyncAnswer(pool, ticket, turn)
    pgAsyncDone(pool, ticket, turn, r.reusable)
    console.log(describe(i === 0 ? "holder" : "holder again", r))
    board.done += 1
    statement = then
  }
}

/** What the crowd's tasks were answered. */
class Tally {
  ok: i32 = 0
  failed: i32 = 0
}

/** Seats `statement`, sends it, and counts its answer in `tally` and itself done. */
async function crowd(pool: PgAsyncPool, board: Board, tally: Tally, statement: i32): Promise<void> {
  const ticket: i32 = await pgAsyncSeat(pool, statement)
  if (ticket < 0) {
    tally.failed += 1
    board.done += 1
    return
  }
  const sent: i32 = await pgAsyncSend(pool, ticket, new PgAsyncParams())
  const turn: i32 = await pgAsyncTurn(pool, ticket, sent)
  const r = await pgAsyncAnswer(pool, ticket, turn)
  pgAsyncDone(pool, ticket, turn, r.reusable)
  if (r.ok()) {
    tally.ok += 1
  } else {
    tally.failed += 1
  }
  board.done += 1
}

/** Waits until `board.done` reaches `n`. */
async function until(board: Board, n: i32): Promise<void> {
  while (board.done < n) {
    await sleep(1)
  }
}

/** Spawns a backend on `listen` and connects `pool`'s one slot to it. */
async function fill(pool: PgAsyncPool, board: Board, listen: i32, port: i32): Promise<i32> {
  spawn(backend(listen, board))
  const config = new PgConfig()
  config.user = "app"
  const pw: u8[] = [112, 119]
  const password = secret(pw)
  const live: i32 = await pgAsyncConnect(pool, config, password, pgTarget("127.0.0.1", port))
  wipe(password)
  return live
}

export async function main(): Promise<i32> {
  const listen: i32 = tcpListen("127.0.0.1", 0, 16)
  if (listen < 0) {
    return 1
  }
  const port: i32 = netLocalPort(listen)
  const board = new Board()
  const handles = new Handles()
  const pool = new PgAsyncPool(1)
  const gate: i32 = pgAsyncPrepare(pool, "gate")
  const echo: i32 = pgAsyncPrepare(pool, "echo")
  const badparse: i32 = pgAsyncPrepare(pool, "badparse")
  const wait: i32 = pgAsyncPrepare(pool, "wait")
  const quick: i32 = pgAsyncPrepare(pool, "quick")
  const die: i32 = pgAsyncPrepare(pool, "die")
  const large: i32 = pgAsyncPrepare(pool, "large")
  console.log(`statements ${gate} ${echo} ${badparse} ${wait} ${quick} ${die} ${large}; a NUL: ${pgAsyncPrepare(pool, "a\u0000")}`)
  let live: i32 = await fill(pool, board, listen, port)
  console.log(`connected ${live} of 1`)

  // 1. Six in flight on one connection.
  board.want = 6
  spawn(pipe(pool, board, handles, gate, "", "gate"))
  for (let i: i32 = 0; i < 5; i++) {
    spawn(pipe(pool, board, handles, echo, `e${i}`, `echo ${i}`))
  }
  await until(board, 6)
  console.log(`parses: ${board.parses}, waits: ${pool.waits}`)

  // 2. A refused Parse mid-batch.
  board.sent = 0
  board.want = 5
  spawn(pipe(pool, board, handles, gate, "", "gate"))
  spawn(pipe(pool, board, handles, badparse, "", "badparse first"))
  spawn(pipe(pool, board, handles, badparse, "", "badparse behind"))
  spawn(pipe(pool, board, handles, echo, "a\u0000b", "echo nul"))
  spawn(pipe(pool, board, handles, echo, "z", "echo behind"))
  await until(board, 11)
  spawn(pipe(pool, board, handles, badparse, "", "badparse again"))
  await until(board, 12)
  console.log(`live: ${pool.live()}, dropped: ${pool.dropped}, parses: ${board.parses}`)

  // 3. Past the input.
  board.sent = 0
  board.want = 3
  spawn(pipe(pool, board, handles, gate, "", "gate"))
  spawn(pipe(pool, board, handles, large, "", "large"))
  spawn(pipe(pool, board, handles, echo, "after", "echo after"))
  await until(board, 15)
  console.log(`live: ${pool.live()}, dropped: ${pool.dropped}`)

  // 4. The wake.
  pool.depth = 1
  let before: i32 = pool.waits
  spawn(pipe(pool, board, handles, wait, "", "wait"))
  spawn(pipe(pool, board, handles, quick, "", "quick"))
  await sleep(20)
  board.open = 1
  await until(board, 17)
  console.log(`waits for the held seat: ${pool.waits - before}`)
  board.open = 0

  // 4b. No barging.
  spawn(again(pool, board, wait, quick))
  await sleep(5)
  spawn(pipe(pool, board, handles, quick, "", "parked"))
  await sleep(20)
  board.open = 1
  await until(board, 20)
  board.open = 0

  // 4c. A crowd.
  const tally = new Tally()
  pool.claimWaitMs = 2000
  spawn(pipe(pool, board, handles, wait, "", "crowd holder"))
  await sleep(5)
  for (let i: i32 = 0; i < 150; i++) {
    spawn(crowd(pool, board, tally, quick))
  }
  await sleep(20)
  board.open = 1
  await until(board, 171)
  board.open = 0
  console.log(`a crowd of 150 behind the held seat: ${tally.ok} answered, ${tally.failed} failed`)

  // 5. A bounded wait.
  pool.claimWaitMs = 30
  before = pool.waits
  spawn(pipe(pool, board, handles, wait, "", "wait"))
  await sleep(5)
  const late: i32 = await pgAsyncSeat(pool, quick)
  console.log(`a seat with the one seat held: ${late} after ${pool.waits - before} wait`)
  board.open = 1
  await until(board, 172)
  board.open = 0
  pool.claimWaitMs = 5000
  pool.depth = 8

  // 6. Cancelled with its answer unread.
  spawn(pipe(pool, board, handles, wait, "", "cancelled"))
  await sleep(5)
  const held: i64 = handles.task
  spawn(pipe(pool, board, handles, quick, "", "behind the cancelled"))
  await sleep(5)
  cancel(held)
  await until(board, 174)
  board.open = 1
  console.log(`live: ${pool.live()}, dropped: ${pool.dropped}`)
  board.open = 0

  // 7. Lost mid-pipeline.
  live = await fill(pool, board, listen, port)
  console.log(`connected ${live} of 1`)
  board.sent = 0
  board.want = 3
  spawn(pipe(pool, board, handles, gate, "", "gate"))
  spawn(pipe(pool, board, handles, die, "", "die"))
  spawn(pipe(pool, board, handles, quick, "", "behind the die"))
  await until(board, 177)
  console.log(`live: ${pool.live()}, dropped: ${pool.dropped}`)

  // 8. Hostile mid-pipeline.
  const big: i32 = pgAsyncPrepare(pool, "big")
  live = await fill(pool, board, listen, port)
  console.log(`connected ${live} of 1`)
  board.sent = 0
  board.want = 3
  spawn(pipe(pool, board, handles, gate, "", "gate"))
  spawn(pipe(pool, board, handles, big, "", "big"))
  spawn(pipe(pool, board, handles, quick, "", "behind the big"))
  await until(board, 180)
  console.log(`live: ${pool.live()}, dropped: ${pool.dropped}`)
  pool.close()
  return 0
}
