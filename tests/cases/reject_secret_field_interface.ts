// A field of an interface cannot be a `Secret`: no `wipe()` of its own ends it.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const sum = (k: u8[]): i32 => toI32(k.length);
const bytes = (): u8[] => [toU8(1), toU8(2)];
interface Holder {
  readonly k: Secret<u8[]>;
}
export const main = (): i32 => 0;
