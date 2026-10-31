// A labelled `break` leaves the loop it names from inside an inner one, and a
// labelled `continue` starts that loop's next turn: the exit and the step are
// the branches a hand-kept `done` flag would take, with no flag.
function firstPair(limit: number, target: number): number {
  let found = -1;
  outer: for (let i = 0; i < limit; i++) {
    for (let j = 0; j < limit; j++) {
      if (i * j === target) {
        found = i * 100 + j;
        break outer;
      }
    }
  }
  return found;
}

function skipRows(rows: number[][]): number {
  let total = 0;
  rows: for (const row of rows) {
    for (const cell of row) {
      if (cell < 0) {
        continue rows;
      }
      total += cell;
    }
    total += 1000;
  }
  return total;
}

function countdown(start: number): number {
  let steps = 0;
  let n = start;
  outer: while (n > 0) {
    n -= 1;
    let k = 0;
    do {
      k += 1;
      steps += 1;
      if (k === n) {
        continue outer;
      }
      if (steps > 20) {
        break outer;
      }
    } while (k < 3);
  }
  return steps;
}

export function test(): number {
  return firstPair(10, 12) + skipRows([[1, 2], [3, -1, 5], [4]]) + countdown(6);
}
