// Every edge that leaves a scoped pass releases it exactly once: the
// back-edge, `continue`, `break`, and a `return`, from nested loops and from
// inside a `switch`, whose `break` stays in the pass. Every function here
// returns a pointer, so no function scope hides what the passes leave, and
// `grows` shows the arena the same height whatever the round count.
class Box {
  n: i32;

  constructor(n: i32) {
    this.n = n;
  }
}

const piece = (i: i32): string => `p${i}`;

// `continue` and `break` out of a `while (true)`.
const skipOdd = (rounds: i32): Box => {
  let total = 0;
  let i = 0;
  while (true) {
    i++;
    const s = piece(i);
    if (i % 2 === 1) {
      continue;
    }
    if (i > rounds) {
      break;
    }
    total += s.length;
  }
  return new Box(total);
};

// Nested scoped loops: `continue` and `break` of the inner loop from a
// `switch`, whose own `break` leaves only the `switch`.
const grid = (n: i32): Box => {
  let total = 0;
  for (let r = 0; r < n; r++) {
    const row = piece(r);
    for (let c = 0; c < n; c++) {
      const cell = piece(c);
      switch (c % 3) {
        case 0:
          continue;
        case 1:
          total += 1;
          break;
        default:
          total += cell.length;
      }
      if (c > r) {
        break;
      }
      total += row.length;
    }
  }
  return new Box(total);
};

// `do...while`, whose `continue` goes to the condition.
const countDown = (rounds: i32): Box => {
  let total = 0;
  let i = rounds;
  do {
    const s = piece(i);
    i--;
    if (i % 3 === 0) {
      continue;
    }
    total += s.length;
  } while (i > 0);
  return new Box(total);
};

// A `return` of memory older than the pass, from two loops deep: `box` is
// declared by the outer pass, but it is an element of `boxes`, which is older
// than both, so both passes are scoped and the `return` releases the
// function's own scope, which rewinds past them.
const find = (boxes: Box[], want: i32): Box => {
  for (let r = 0; r < 3; r++) {
    for (const box of boxes) {
      const s = piece(box.n + r);
      if (s.length === want) {
        return box;
      }
    }
  }
  return boxes[0];
};

// A scalar tail call from inside a scoped pass releases ahead of the call.
const settle = (i: i32): i32 => i * 2;

const firstWide = (rounds: i32): i32 => {
  for (let i = 0; i < rounds; i++) {
    const s = piece(i);
    if (s.length > 3) {
      return settle(i);
    }
  }
  return -1;
};

const growth = (which: i32, rounds: i32): string => {
  const m = Arena.mark();
  const before = Arena.used();
  let n = 0;
  if (which === 0) {
    n = skipOdd(rounds).n;
  } else if (which === 1) {
    n = grid(rounds).n;
  } else {
    n = countDown(rounds).n;
  }
  const grown = Arena.used() - before;
  Arena.release(m);
  return `${n} ${grown}`;
};

export const main = (): void => {
  console.log(`${growth(0, 5)} | ${growth(0, 300)}`);
  console.log(`${growth(1, 5)} | ${growth(1, 300)}`);
  console.log(`${growth(2, 5)} | ${growth(2, 300)}`);
  const boxes: Box[] = [];
  for (let i = 0; i < 200; i++) {
    boxes.push(new Box(i));
  }
  console.log(`${find(boxes, 4).n} ${find(boxes, 9).n}`);
  console.log(`${firstWide(2000)}`);
};
