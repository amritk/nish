// --deny-panics keeps a down-counting index below the length of the string it
// started at, not another one: `u` may be shorter than `t`.
export const f = (t: string, u: string): i32 => {
  let end: i32 = toI32(t.length);
  while (end > 0 && u.charCodeAt(end - 1) === 32) {
    end -= 1;
  }
  return end;
};
