import { scope, parallelFrom } from "nish/threads";
class H {
  x: i32 = 1;
}
const work = (h: H): i32 => {
  h.x = 50;
  return 0;
};
export const main = (): i32 => {
  const h = new H();
  const done: i32[] = [0];
  { using s = scope(); s.spawn(work, h, done, 0); const ys = parallelFrom(1, (i) => h.x + i); console.log(`${ys[0]}`); }
  console.log(`${h.x}`); return 0;
};
