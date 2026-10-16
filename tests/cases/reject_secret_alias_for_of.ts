// A `for...of` binding is an element of the array it walks, which still holds it.
import { Secret, secret, wipe } from "nish:secret";
export const main = (): i32 => {
  const rows: u8[][] = [[1], [2]];
  for (const row of rows) {
    const key: Secret<u8[]> = secret(row);
    wipe(key);
    break;
  }
  return toI32(rows[0][0]);
};
