import { fromA, labelA } from "./a";
import { fromB, labelB } from "./b";
import { pick } from "./lib";

export const main = (): i32 => {
  console.log(labelA());
  console.log(labelB());
  console.log(pick("main-first", "main-second", true));
  return fromA() + fromB() + pick(1, 2, false);
};
