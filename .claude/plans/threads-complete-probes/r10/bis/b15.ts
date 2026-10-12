import { scope } from "nish/threads";
class Leaf { x: i32 = 0; }
const read = (l: Leaf): i32 => l.x + 1;
export const main = (): i32 => {
  const a = new Leaf(); const d0: i32[] = [0]; const d1: i32[] = [0];
  { using s = scope(); s.spawn(read, a, d0, 0); }
  { using s = scope(); s.spawn(read, a, d1, 0); }
  console.log(`${d0[0]} ${d1[0]}`); return 0;
};
