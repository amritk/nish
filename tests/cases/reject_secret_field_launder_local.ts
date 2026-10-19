// The rule that keeps a borrowed `Secret` from coming back holds for a caller's own local too, not only a holder's field.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
function id(s: Secret<u8[]>): Secret<u8[]> {
  return s;
}
export const main = (): i32 => {
  const l = secret(bytes());
  const a = id(l);
  const n = expose(a, sum);
  wipe(a);
  wipe(l);
  return n;
};
