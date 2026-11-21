// --deny-panics keeps a down-counting index below the length only when it
// starts at the length: `end` starting at a parameter may start past it.
export const f = (t: string, n: i32): i32 => {
  let end: i32 = n;
  while (end > 0 && t.charCodeAt(end - 1) === 32) {
    end -= 1;
  }
  return end;
};
