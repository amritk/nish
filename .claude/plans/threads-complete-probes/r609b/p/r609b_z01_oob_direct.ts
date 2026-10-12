export const main = (): i32 => {
  const tab = new Int32Array(10);
  tab.fill(7);
  const ys: i32[] = [];
  for (let i: i32 = 0; i < 12; i++) ys.push(tab[i]);
  console.log(`${ys[11]}`);
  return 0;
};
