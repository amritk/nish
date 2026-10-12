import { parallelFrom } from "nish/threads";
const helper = (): i32 => {
  const at = "héllo".indexOf("l");
  const ys = parallelFrom(2, (i): i32 => {
    return at + i;
  });
  return ys[1];
};
export const main = (): i32 => {
  console.log(`${helper()}`);
  return 0;
};
