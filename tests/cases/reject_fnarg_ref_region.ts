// WP51 stage 2: the region runners take no function reference: what runs
// in a region reads nothing outside it.
import { enter, region } from "nish:region";
type F = () => i32;
const seven = (): i32 => 7;
export const main = (): i32 => {
  const h: F = seven;
  const r = region(h);
  return enter(r, (n: i32): i32 => n);
};
