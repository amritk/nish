// A `Secret` cannot be interpolated into a template literal.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  const k = secret(bytes());
  const s = `${k}`;
  wipe(k);
  return 0;
};
