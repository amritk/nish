import { fromA, labelA } from "./a";
import { fromB, labelB } from "./b";
import { Holder } from "./lib";

export const main = (): i32 => {
  console.log(labelA());
  console.log(labelB());
  console.log(new Holder(true).pick("main-first", "main-second"));
  return fromA() + fromB();
};
