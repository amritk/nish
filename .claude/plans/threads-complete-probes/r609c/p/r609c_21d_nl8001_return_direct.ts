export const main = (): i32 => {
  const n: i32 = 2;
  const at = "héllo".indexOf("l");
  const ys: i32[] = [];
  for (let i: i32 = 0; i < n; i++) ys.push(at + i);
  console.log(`${ys[1]}`);
  return 0;
};
