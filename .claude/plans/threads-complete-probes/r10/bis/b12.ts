import { scope } from "nish/threads";
const len = (a: i32[]): i32 => a.length;
export const main = (): i32 => {
  const a: i32[] = [1, 2]; const done: i32[] = [0, 0];
  { using s = scope(); s.spawn(len, a, done, 0); s.spawn(len, a, done, 1); }
  console.log(`${done[0]} ${done[1]}`); return 0;
};
