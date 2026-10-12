// A helper that shrinks its array before returning it gives no length: the
// rule reads only indexing, `.length` and `push` as uses that keep it. The
// read of `xs[3]` keeps its check, and panics.
const shrunk = (): i32[] => {
  const arr = new Array<i32>(4);
  arr.pop();
  return arr;
};

export const main = (): number => {
  const xs = shrunk();
  console.log(`${xs[3]}`);
  return 0;
};
