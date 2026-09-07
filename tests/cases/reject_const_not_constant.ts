// The initialiser must be foldable: a call has no value at compile time.
const LIMIT: i32 = size();

function size(): i32 {
  return 10;
}
