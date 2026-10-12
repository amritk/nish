import { scope } from "nish/threads";
const sq = (n: i32): i32 => n * n;
export const main = (): i32 => {
  const done: i32[] = [0, 0];
  { using s = scope(); s.spawn(sq, 3, done, 0); s.spawn(sq, 4, done, 1); }
  console.log(`${done[0]} ${done[1]}`); return 0;
};
