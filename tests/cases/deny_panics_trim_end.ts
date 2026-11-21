// --deny-panics proves `t.charCodeAt(end - 1)` in a loop that only counts
// `end` down from `t.length` while `end > 0`: the first read is the last
// byte, and no index check or overflow check is left.
const trimmedEnd = (t: string): i32 => {
  let end: i32 = toI32(t.length);
  while (end > 0 && t.charCodeAt(end - 1) === 32) {
    end -= 1;
  }
  return end;
};

const leading = (t: string): i32 => {
  let start: i32 = 0;
  while (start < toI32(t.length) && t.charCodeAt(start) === 32) {
    start += 1;
  }
  return start;
};

export const main = (): number => {
  console.log(trimmedEnd("ab  "));
  console.log(trimmedEnd("ab"));
  console.log(trimmedEnd("   "));
  console.log(trimmedEnd(""));
  console.log(leading("  ab"));
  return 0;
};
