// A `Secret` holds integers only: a string has no single run of bytes for `wipe` to zero.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
export const main = (): i32 => { const s = secret("key"); wipe(s); return 0; };
