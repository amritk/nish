// WP51 stage 2: `enterWith` takes no function reference.
import { enterWith, region } from "nish:region";
type F = (root: i32, a: i32) => i32;
const seven = (): i32 => 7;
const add = (root: i32, a: i32): i32 => root + a;
export const main = (): i32 => {
  const h: F = add;
  const r = region(seven);
  return enterWith(r, 1, h);
};
