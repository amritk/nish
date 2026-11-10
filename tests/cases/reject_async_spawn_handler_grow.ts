// WP49 stage 5, part 8: a handler grows an array of the object it captured
// (NL2615)
import { sleep, spawn } from "nish:async"

class Request {
  n: i32
  constructor(n: i32) {
    this.n = n
  }
}

class Board {
  hits: i32 = 0
  last: Request
  items: i32[]
  constructor() {
    this.last = new Request(0)
    this.items = []
  }
}

async function serveOne(handle: (req: Request) => Promise<i32>, n: i32): Promise<void> {
  await sleep(1)
  const answer = await handle(new Request(n))
  console.log(`${answer}`)
}

async function start(board: Board): Promise<void> {
  spawn(serveOne(async (req: Request): Promise<i32> => {
    board.items.push(req.n)
    return 0
  }, 1))
}
export async function main(): Promise<i32> {
  await start(new Board())
  return 0
}
