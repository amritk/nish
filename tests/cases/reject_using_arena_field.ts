// A `using a = arena()` block may not store what it allocated into a field of
// an object: `b` is older than the block and would hold freed memory.
class Box {
  label: string = "";
}

export const main = (): i32 => {
  const b = new Box();
  {
    using a = arena();
    b.label = `box ${b.label.length}`;
  }
  console.log(b.label);
  return 0;
};
