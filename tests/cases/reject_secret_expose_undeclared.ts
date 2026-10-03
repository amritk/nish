// The arrow given to `expose` names what leaves: its return type is written down.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  const k = secret(bytes());
  const x = expose(k, (v: u8[]) => toI32(v.length));
  wipe(k);
  return x;
};
