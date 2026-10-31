// An arrow given to an ordinary function parameter, run before the move, is
// a second name for the array while it runs, as a data-parallel arrow's
// capture is, so `secret(raw)` after it cannot move `raw`.
import { secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const each = (n: i32, f: (i: i32) => void): void => {
  for (let i = 0; i < n; i++) {
    f(i);
  }
};
export const main = (): i32 => {
  const raw = bytes();
  each(2, (i) => {
    console.log(`${raw[i]}`);
  });
  const k = secret(raw);
  wipe(k);
  return 0;
};
