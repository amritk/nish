type F = (x: i32) => i32;
const square = (x: i32): i32 => x * x;
const plus1 = (x: i32): i32 => x + 1;

class Slot {
  op: F | null = null;
}

const pick = (k: i32): F | null => {
  if (k === 0) {
    return null;
  }
  return k === 1 ? square : plus1;
};

const run = (h: F | null, x: i32): i32 => {
  if (h === null) {
    return -1;
  }
  return h(x);
};

export const main = (): void => {
  const s = new Slot();
  console.log(`${s.op === null}`);
  s.op = plus1;
  const o = s.op;
  if (o !== null) {
    console.log(`${o(4)}`);
  }
  const hs = new Array<F | null>(3);
  hs[1] = square;
  let total = 0;
  for (let i = 0; i < 3; i++) {
    total = total + run(hs[i], 3) + run(pick(i), 2);
  }
  console.log(`${total}`);
};
