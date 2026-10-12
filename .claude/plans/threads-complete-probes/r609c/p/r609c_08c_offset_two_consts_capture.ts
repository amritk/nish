import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const word = "héllo";
  const pad: i32[] = [7, 7];
  const at = word.indexOf("l");
  const a = at + pad.length;
  const b = a;
  const ys = parallelFrom(1, (k) => (b === 4 ? 1 : 0) + k);
  console.log(`${ys[0]}`);
  return 0;
};
