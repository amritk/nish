// The one shape monomorphisation cannot finish: the recursive call puts `T`
// under a constructor, so `grow<i32>` needs `grow<i32[]>` needs `grow<i32[][]>`.
// One expanding self-edge and nothing else, which is what makes this the
// opposite of `gen_recursive_ground`. WP18 §4.
const grow = <T>(x: T, n: i32): i32 => {
  if (n === 0) {
    return 0;
  }
  return grow([x], n - 1);
};

export const test = (): number => grow(1, 3);
