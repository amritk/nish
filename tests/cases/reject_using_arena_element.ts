// A `using a = arena()` block may not store what it allocated into an array
// element: `names` is older than the block and would hold freed memory.
export const main = (): i32 => {
  const names: string[] = ["a", "b"];
  {
    using a = arena();
    names[1] = `name ${names.length}`;
  }
  console.log(names[1]);
  return 0;
};
