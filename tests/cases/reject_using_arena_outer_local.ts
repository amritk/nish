// A `using a = arena()` block may not keep what it allocated in a local
// declared outside it: `last` would point into freed memory after the block.
export const main = (): i32 => {
  let last = "";
  for (let i = 0; i < 3; i++) {
    using a = arena();
    last = `item ${i}`;
  }
  console.log(last);
  return 0;
};
