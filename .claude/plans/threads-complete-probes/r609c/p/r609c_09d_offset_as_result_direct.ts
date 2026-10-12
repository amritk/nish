export const main = (): i32 => {
  const word = "héllo";
  const at = word.indexOf("l");
  const ys: i32[] = [];
  for (let k: i32 = 0; k < 2; k++) ys.push(at + k);
  console.log(`${ys[1]}`);
  return 0;
};
