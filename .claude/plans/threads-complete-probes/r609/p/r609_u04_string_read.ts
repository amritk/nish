import { parallelFrom } from "nish/threads";
export const main = (): i32 => {
  const text = "hello, parallel world";
  const codes = parallelFrom(text.length, (i) => text.charCodeAt(i) ^ 32);
  let n: i32 = 0;
  for (const c of codes) n = n + c;
  console.log(`${codes.length} ${n}`);
  return 0;
};
