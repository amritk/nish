export const main = (): i32 => {
  const word = "nish";
  const ys: i32[] = [];
  for (let i: i32 = 0; i < 4; i++) ys.push(word.charCodeAt(i));
  console.log(`${ys[0]} ${ys[3]}`);
  return 0;
};
