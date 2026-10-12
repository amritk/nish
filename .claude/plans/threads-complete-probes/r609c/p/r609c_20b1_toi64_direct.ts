export const main = (): i32 => {
  const xs64: i64[] = [1, 2, 3];
  const k: i32 = 2;
  const ys: i64[] = [];
  for (const x of xs64) ys.push(x * toI64(k));
  console.log(`${ys[0]} ${ys[2]}`);
  return 0;
};
