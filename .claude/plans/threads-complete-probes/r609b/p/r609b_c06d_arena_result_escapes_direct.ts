export const main = (): i32 => {
  let r: i32[] = [];
  {
    using a = arena();
    const t: i32[] = [1, 2, 3];
    const u: i32[] = [];
    for (const x of t) u.push(x * 2);
    r = u;
  }
  console.log(`${r[2]}`);
  return 0;
};
