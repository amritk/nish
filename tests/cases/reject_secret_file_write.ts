// A `Secret` cannot be handed to a builtin that writes a file.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  const k = secret(bytes());
  writeFileSync("key.bin", k);
  wipe(k);
  return 0;
};
