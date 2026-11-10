// WP49 stage 5, part 8: in a task, a call's answer leaves out an argument
// only when no type the answer reaches is one the argument reaches. A holder
// of one of the board's tallies, a `Holder` built from a `Board`, and an
// interface the shared class implements all may reach the shared object, so
// a store through them is still refused (NL2609).
import { sleep, spawn } from "nish:async"

interface Named {
  label: string
}

class Tally implements Named {
  label: string = ""
}

class Board {
  tallies: Tally[]
  constructor() {
    this.tallies = [new Tally()]
  }
}

class Holder {
  t: Tally
  constructor(t: Tally) {
    this.t = t
  }
}

class Badge {
  n: Named
  constructor(n: Named) {
    this.n = n
  }
}

async function first(b: Board): Promise<Holder> {
  await sleep(1)
  return new Holder(b.tallies[0])
}

function badge(t: Tally): Badge {
  return new Badge(t)
}

async function work(board: Board, ms: i32): Promise<void> {
  const h = await first(board)
  h.t.label = `h ${ms}`
  const g = badge(board.tallies[0])
  g.n.label = `g ${ms}`
}

export async function main(): Promise<i32> {
  const board = new Board()
  spawn(work(board, 1))
  return 0
}
