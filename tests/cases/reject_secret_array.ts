// A `Secret` cannot be an array element: the element outlives the function that made it.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
const f = (ks: Secret<u8[]>[]): i32 => 0;
export const main = (): i32 => 0;
