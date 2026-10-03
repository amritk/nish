// A `using a = arena()` block may not `push` onto an array older than the
// block: growing it moves its storage into memory the block releases, even
// when what is pushed is a number, and whether the array is a local or a field.
class Bag {
  xs: i32[];

  constructor() {
    this.xs = [];
  }
}

export const main = (): i32 => {
  const xs: i32[] = [];
  const bag = new Bag();
  {
    using a = arena();
    xs.push(1);
  }
  {
    using a = arena();
    bag.xs.push(2);
  }
  console.log(`${xs.length} ${bag.xs.length}`);
  return 0;
};
