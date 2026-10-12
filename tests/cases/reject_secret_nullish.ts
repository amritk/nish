// `??` answers one of its operands, so a `Secret` on either side would be a
// second name for it, which nobody would wipe: it is a copy.
import { Secret, secret, wipe } from "nish:secret";
const pick = (k: Secret<u8[]> | null, fallback: Secret<u8[]>): i32 => {
  const mine = k ?? fallback;
  wipe(mine);
  return 0;
};
export const main = (): i32 => 0;
