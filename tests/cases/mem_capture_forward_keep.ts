// The negative of `mem_capture_read_stack` through a second instance: the
// arrow is handed on from `twice` to `each`, and pushes what it captures onto
// an array the caller keeps. The capture is an argument to the arrow wherever
// the arrow is forwarded, so `b` and `name` escape and stay in the arena.
// Each kept value reads back intact after `churn` has reused every byte a
// wrong release would have freed.

class Box {
  s: string;

  constructor(s: string) {
    this.s = s;
  }
}

const each = (xs: i32[], f: (x: i32) => void): void => {
  for (const x of xs) {
    f(x);
  }
};

const twice = (xs: i32[], f: (x: i32) => void): void => {
  each(xs, f);
  each(xs, f);
};

// Reuse the arena above wherever the kept values live.
const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 2000; i++) {
    t = t + `yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy${i}`.length;
  }
  return t;
};

const fill = (boxes: Box[], names: string[], n: i32): void => {
  for (let i = 0; i < n; i++) {
    const b = new Box(`b${i}`);
    const name = `n${i}`;
    twice([i], (x) => {
      boxes.push(b);
      names.push(name);
    });
  }
};

export const main = (): void => {
  const boxes: Box[] = [];
  const names: string[] = [];
  fill(boxes, names, 300);
  console.log(`${churn()}`);
  console.log(`${boxes.length} ${boxes[0].s} ${boxes[599].s} ${names[1]} ${names[598]}`);
};
