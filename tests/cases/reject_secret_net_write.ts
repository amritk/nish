// A `Secret` cannot be handed to a socket, under an import of `nish:net` too.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
import { netWrite } from "nish:net";
export const main = (): i32 => {
  const k = secret(bytes());
  const n = netWrite(3, k, 0, 2);
  wipe(k);
  return n;
};
