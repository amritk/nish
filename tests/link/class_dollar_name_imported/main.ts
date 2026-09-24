// `class_dollar_name` in the other load order: the template is in the entry.
import { mk } from "./lib";

class Box<T> {
  lead: i32;
  v: T;

  constructor(v: T) {
    this.lead = 9;
    this.v = v;
  }
}

const rd = (b: Box<i32>): i32 => b.v;

export const main = (): i32 => {
  console.log(rd(mk()));
  return 0;
};
