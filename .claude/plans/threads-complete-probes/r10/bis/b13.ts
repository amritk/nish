import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
const read = (l: Leaf): i32 => l.x + 1;
const read2 = (l: Leaf): i32 => l.x + 2;
export const main = (): i32 => {
  const a = new Leaf(); const done: i32[] = [0, 0];
  { using s = scope(); s.spawn(read, a, done, 0); s.spawn(read2, a, done, 1); }
  console.log(`${done[0]} ${done[1]}`); return 0;
};
