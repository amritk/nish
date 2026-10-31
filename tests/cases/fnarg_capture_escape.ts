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
const churn = (): i32 => {
  let t = 0;
  for (let i = 0; i < 2000; i++) {
    t = t + `yyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy${i}`.length;
  }
  return t;
};
const fill = (keep: string[], boxes: Box[], n: i32): void => {
  for (let i = 0; i < n; i++) {
    const s = `s${i}`;
    const b = new Box(`b${i}`);
    each([i], (x) => {
      keep.push(s);
      keep.push(`p${x}`);
      boxes.push(b);
    });
  }
};
export const main = (): void => {
  const keep: string[] = [];
  const boxes: Box[] = [];
  fill(keep, boxes, 300);
  console.log(`${churn()}`);
  console.log(`${keep[0]} ${keep[1]} ${keep[598]} ${keep[599]} ${boxes[0].s} ${boxes[299].s}`);
  const local: string[] = [];
  for (let i = 0; i < 5; i++) {
    each([i], (x) => {
      local.push(`q${x}`);
    });
  }
  console.log(`${churn()}`);
  console.log(local.join(","));
};
