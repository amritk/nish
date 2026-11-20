// --deny-panics keeps `end - 2` in range only where the guard puts `end` at
// two or more: `end > 0` lets `end` be 1, and the index -1 stays checked.
export const f = (t: string): i32 => {
  let end: i32 = toI32(t.length);
  while (end > 0 && t.charCodeAt(end - 2) === 32) {
    end -= 2;
  }
  return end;
};
