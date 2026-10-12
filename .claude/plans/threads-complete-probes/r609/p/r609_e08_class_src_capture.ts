import { parallelMap } from "nish/threads";
class Pt {
  x: i32;
  constructor(x: i32) {
    this.x = x;
  }
}
export const main = (): i32 => {
  const pts: Pt[] = [];
  for (let i: i32 = 0; i < 1000000; i++) pts.push(new Pt(i % 97));
  const k: i32 = 5;
  const ys = parallelMap(pts, (p) => p.x * k);
  let s: i32 = 0;
  for (const y of ys) s = (s + y) % 1000003;
  console.log(`${s}`);
  return 0;
};
