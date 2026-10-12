import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const word = "héllo";
  const at = word.indexOf("l");
  const ys = parallelFrom(1, (k) => (at === 2 ? 1 : 0) + k);
  console.log(`${ys[0]}`);
  return 0;
};
