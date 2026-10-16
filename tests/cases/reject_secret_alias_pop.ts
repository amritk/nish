// What a method of a value answers is never taken as fresh: `rows.pop()` answers
// an element `rows` held, which another name may still hold.
import { Secret, secret, wipe } from "nish:secret";
export const main = (): i32 => {
  const rows: u8[][] = [[1], [2]];
  const key: Secret<u8[]> = secret(rows.pop());
  wipe(key);
  return 0;
};
