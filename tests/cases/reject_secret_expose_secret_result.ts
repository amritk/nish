// What `expose` returns is declassified, so it may not be a `Secret`.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const again = (k: u8[]): Secret<u8[]> => secret(bytes());
export const main = (): i32 => {
  const k = secret(bytes());
  const j = expose(k, again);
  wipe(j);
  wipe(k);
  return 0;
};
