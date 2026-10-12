import { parallelMap } from "nish/threads";
class Config {
  lo: i32;
  hi: i32;
  constructor(lo: i32, hi: i32) {
    this.lo = lo;
    this.hi = hi;
  }
}
const clampAll = (xs: i32[], cfg: Config): i32[] => parallelMap(xs, (x) => (x < cfg.lo ? cfg.lo : x > cfg.hi ? cfg.hi : x));
export const main = (): i32 => {
  const r = clampAll([-5, 3, 99, 7], new Config(0, 10));
  console.log(`${r[0]} ${r[1]} ${r[2]} ${r[3]}`);
  return 0;
};
