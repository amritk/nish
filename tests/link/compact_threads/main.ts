// WP48: compact objects read on other threads. `parallelMapInto` hands each
// task a `Cell` from the array and the task follows its offset link; the
// channel's own sender state is a plain pointer, so a program with a compact
// class still sends through it.
import { Compact } from "nish:compact"
import { Channel, parallelMapInto, scope } from "nish/threads"

class Cell implements Compact {
  value: i32
  next: Cell | null
  constructor(value: i32, next: Cell | null) {
    this.value = value
    this.next = next
  }
}

class Pipe {
  ch: Channel<i32>
  head: Cell
  constructor(ch: Channel<i32>, head: Cell) {
    this.ch = ch
    this.head = head
  }
}

const sumFrom = (c: Cell): i32 => {
  let total: i32 = 0
  let at: Cell | null = c
  while (at !== null) {
    total = total + at.value
    at = at.next
  }
  return total
}

const produce = (p: Pipe): i32 => {
  let at: Cell | null = p.head
  let sent: i32 = 0
  while (at !== null) {
    p.ch.send(at.value)
    sent = sent + 1
    at = at.next
  }
  return sent
}

const consume = (p: Pipe): i32 => {
  let sum: i32 = 0
  for (const x of p.ch) {
    sum = sum + x
  }
  return sum
}

export const main = (): i32 => {
  const cells: Cell[] = []
  let prev: Cell | null = null
  for (let i: i32 = 1; i <= 6; i++) {
    const cell = new Cell(i, prev)
    cells.push(cell)
    prev = cell
  }
  const sums: i32[] = [0, 0, 0, 0, 0, 0]
  parallelMapInto(cells, sums, sumFrom)
  console.log(`${sums[0]} ${sums[2]} ${sums[5]}`)

  const sent: i32[] = [0]
  const got: i32[] = [0]
  const ch = new Channel<i32>()
  {
    using s = scope()
    s.spawn(produce, new Pipe(ch, cells[5]), sent, 0)
    s.spawn(consume, new Pipe(ch, cells[0]), got, 0)
  }
  console.log(`${sent[0]} ${got[0]}`)
  return 0
};
