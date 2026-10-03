// `nish:secret`: a `Secret<u8[]>` made by `secret`, read through `expose` with a
// named function and through `exposeWith` with an arrow, then wiped. The golden
// pins the three things the module is for: `wipe`'s instance is one volatile
// `llvm.memset` over the array's whole capacity (`i1 true`), its parameter is
// not `readonly` (the empty source body would have said it was), and nothing
// the program does with the key reaches a builtin. The round trip prints what
// was computed from the key, and the sum of a copy `wipe` has zeroed.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";

const key = (): u8[] => [3, 1, 4, 1, 5];

/** The sum of the key's bytes: what leaves is this `i32`, never the bytes. */
const sum = (k: u8[]): i32 => {
  let total: i32 = 0;
  for (let i: i32 = 0; i < toI32(k.length); i++) {
    total = total + toI32(k[i]);
  }
  return total;
};

/** The sum of a copy of the key once `wipe` has zeroed it: 0, whatever the key. */
const wipedSum = (k: u8[]): i32 => {
  const copy: u8[] = new Array<u8>(k.length);
  copy.set(k, 0);
  wipe(copy);
  return sum(copy);
};

export const main = (): i32 => {
  const k: Secret<u8[]> = secret(key());
  console.log(expose(k, sum));
  console.log(exposeWith(k, 10, (v: u8[], scale: i32): i32 => toI32(v.length) * scale));
  console.log(expose(k, wipedSum));
  wipe(k);
  return 0;
};
