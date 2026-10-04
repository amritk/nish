// --deny-panics over a cycle of calls in which each function calls the next
// before its own addition: the resolution terminates, and each unproven `+`
// is refused where it is written.
const a0 = (d: u32, k: i32): i32 => (d === 0 ? 0 : a1(d - 1, k) + k);
const a1 = (d: u32, k: i32): i32 => (d === 0 ? 0 : a2(d - 1, k) + k);
const a2 = (d: u32, k: i32): i32 => (d === 0 ? 0 : a0(d - 1, k) + k);

export const main = (): number => {
  console.log(a0(5, process.argv.length));
  return 0;
};
