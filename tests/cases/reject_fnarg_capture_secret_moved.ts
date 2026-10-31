// An arrow given to an ordinary function parameter reads the local it
// captures where the call runs it: after `secret(raw)` moved it, that read
// is the key outside the `Secret`, so it is refused as any other read is.
import { secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const each = (n: i32, f: (i: i32) => void): void => {
  for (let i = 0; i < n; i++) {
    f(i);
  }
};
export const main = (): i32 => {
  const raw = bytes();
  const k = secret(raw);
  wipe(k);
  each(2, (i) => {
    console.log(`${raw[i]}`);
  });
  return 0;
};
