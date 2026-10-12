// Instantiates `lib.ts`'s generic chain for a class `T` and a string `T`.
import { Box, firstName, nextItem } from "./lib";

export const main = (): i32 => {
  const a = new Box<i32>(1);
  a.next = new Box<i32>(2);
  const s = new Box<string>("x");
  console.log(`${nextItem(a, -1)} ${nextItem(a.next, -1)} ${nextItem(s, "none")} ${firstName(s)}`);
  return 0;
};
