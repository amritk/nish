// What an array method answers may be what the array still holds: `pop` answers
// an element, and `secret` cannot move it out of every other name it has.
import { Secret, secret, wipe } from "nish:secret";
export const main = (): i32 => {
  const rows: u8[][] = [[1], [2]];
  const first = rows[0];
  rows.push(first);
  const key: Secret<u8[]> = secret(rows.pop());
  wipe(key);
  return toI32(first[0]);
};
