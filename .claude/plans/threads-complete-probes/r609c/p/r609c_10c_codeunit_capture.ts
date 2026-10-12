import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const word = "héllo";
  const c = word.charCodeAt(1);
  const ys = parallelFrom(1, (k) => (c === 233 ? 1 : 0) + k);
  console.log(`${ys[0]}`);
  return 0;
};
