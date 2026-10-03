// What a `Secret` holds is read only through `expose`.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  const k = secret(bytes());
  const v: u8[] = k.value;
  wipe(k);
  return 0;
};
