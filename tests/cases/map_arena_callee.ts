// WP32: a callee inserts into its caller's map, from inside loops whose bodies
// build their keys as temporaries. The keys, and every array the table grows
// into, must outlive each iteration and each call: `set` keeps its key and
// allocates into the map it was given, so neither the callee's arena scope nor
// a loop's may release them (#221). Every key is read back after the loops.
const fill = (m: Map<string, i32>, round: i32): void => {
  for (let i: i32 = 0; i < 300; i++) {
    m.set(`r${round}k${i}`, round * 1000 + i);
  }
};

export const main = (): i32 => {
  const m = new Map<string, i32>();
  for (let round: i32 = 0; round < 4; round++) {
    fill(m, round);
    const scratch = `scratch${round}`;
    m.set(scratch, round);
  }
  let found: i32 = 0;
  for (let round: i32 = 0; round < 4; round++) {
    for (let i: i32 = 0; i < 300; i++) {
      if (m.has(`r${round}k${i}`)) {
        found++;
      }
    }
  }
  console.log(`${m.size} ${found} ${m.has("scratch3")} ${m.has("r4k0")}`);
  return 0;
};
