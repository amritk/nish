// WP49 stage 5, part 8: a spawned task's function argument may capture what
// its spawner may share with the task: numbers, booleans, enums and objects
// or arrays that pass the spawn's argument rule. `start` builds a `Board`
// and hands two tasks a handler arrow that reads it and a number; the async
// handler awaits inside the task, as a serve handler awaits a pooled query.
// The arrow's body is walked with the task's region rules, the capture as
// memory the task does not own, so a store of region memory into it, or a
// growth of it, is refused (NL2609, NL2615). The spawner releases no arena
// scope over a captured object (`FunctionFacts.feedsTasks`), so it outlives
// the tasks.
import { sleep, spawn } from "nish:async"

class Board {
  hits: i32 = 0
  total: i32 = 0
  open: boolean = true
}

class Query {
  n: i32
  constructor(n: i32) {
    this.n = n
  }
}

async function serveOne(handle: (q: Query) => Promise<i32>, n: i32, ms: i32): Promise<void> {
  await sleep(ms)
  const answer = await handle(new Query(n))
  console.log(`task ${n}: answer ${answer}`)
}

async function start(): Promise<Board> {
  const board = new Board()
  const scale = 10
  for (let i = 1; i <= 2; i++) {
    spawn(serveOne(async (q: Query): Promise<i32> => {
      await sleep(1)
      board.hits = board.hits + 1
      board.total = board.total + q.n * scale
      return board.open ? board.total : -1
    }, i, 5 * i))
  }
  console.log("start returns")
  return board
}

export async function main(): Promise<i32> {
  const board = await start()
  await sleep(40)
  console.log(`main: hits ${board.hits} total ${board.total}`)
  return 0
}
