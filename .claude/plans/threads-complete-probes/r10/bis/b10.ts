import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
const read = (l: Leaf): i32 => l.x;
export const main = (): i32 => {
  const l = new Leaf(); const done: i32[] = [0, 0];
  { using s = scope(); s.spawn(read, l, done, 0); s.spawn(read, l, done, 1); }
  console.log(`${done[0]} ${done[1]}`); return 0;
};
