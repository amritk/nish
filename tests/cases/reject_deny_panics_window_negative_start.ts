// --deny-panics refuses a difference `a - b` whose guard checks `b <= a` but
// not `b >= 0`: with `b` negative, `a - b` can pass the i32 range (a = 0,
// b = -2147483648), so the subtraction keeps its overflow check.
export const span = (a: i32, b: i32): i32 => {
  if (b <= a) {
    return a - b;
  }
  return 0;
};
