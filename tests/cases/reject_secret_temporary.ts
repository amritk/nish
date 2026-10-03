// A `Secret` made as an argument is owned by nobody, so nobody wipes it.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const n = (k: u8[]): i32 => toI32(k.length);
export const main = (): i32 => expose(secret(bytes()), n);
