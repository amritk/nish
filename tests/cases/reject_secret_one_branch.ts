// Wiped on one arm of an `if` is not wiped: the analysis is per path, unlike Result rule 1.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => {
  const k = secret(bytes());
  if (process.argv.length > 3) {
    wipe(k);
  }
  return 0;
};
