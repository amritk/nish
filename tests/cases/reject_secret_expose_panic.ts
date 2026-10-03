// A `panic` whose message is computed from the key is output.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const leak = (k: u8[]): i32 => {
  if (k.length > 0) {
    panic(`first byte ${k[0]}`);
  }
  return 0;
};
export const main = (): i32 => {
  const k = secret(bytes());
  const x = expose(k, leak);
  wipe(k);
  return x;
};
