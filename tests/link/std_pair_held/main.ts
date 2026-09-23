import { Pair } from "nish/pair";
import { step } from "./lib";

class Cursor {
  last: Pair<i32, boolean>;
  constructor() {
    this.last = { first: 0, second: false };
  }
}

export const main = (): i32 => {
  const c = new Cursor();
  const seen: Pair<i32, boolean>[] = [];
  for (let i: i32 = 0; i < 3; i++) {
    c.last = step(i);
    seen.push(c.last);
  }
  console.log(`${c.last.first} ${c.last.second} ${seen.length} ${seen[0].second}`);
  return 0;
};
