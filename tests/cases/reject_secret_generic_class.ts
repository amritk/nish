// A `Secret` cannot be a type argument of a class: it would be that class's field.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";
const bytes = (): u8[] => [1, 2];
class Box<T> {
  v: T;
  constructor(v: T) {
    this.v = v;
  }
}
const f = (k: Secret<u8[]>): i32 => {
  const b = new Box<Secret<u8[]>>(k);
  return 0;
};
export const main = (): i32 => 0;
