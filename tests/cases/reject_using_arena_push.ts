// A `using a = arena()` block may not `push` onto an array older than the
// block: growing it moves its storage into memory the block releases, even
// when what is pushed is a number.
export const main = (): i32 => {
  const xs: i32[] = [];
  {
    using a = arena();
    xs.push(1);
  }
  console.log(`${xs.length}`);
  return 0;
};
