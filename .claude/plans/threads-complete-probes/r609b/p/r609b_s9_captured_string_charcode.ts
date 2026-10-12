import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const word = "nish";
  const ys = parallelFrom(4, (i) => word.charCodeAt(i));
  console.log(`${ys[0]} ${ys[3]}`);
  return 0;
};
