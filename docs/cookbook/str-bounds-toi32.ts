const countCode = (s: string, code: i32): i32 => {
  const n: i32 = toI32(s.length);
  let count: i32 = 0;
  let i: i32 = 0;
  while (i < n) {
    if (toI32(s.charCodeAt(i)) === code) {
      count += 1;
    }
    i += 1;
  }
  return count;
};
