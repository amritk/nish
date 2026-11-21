// --deny-panics keeps a down-counting index below the length only when no
// write to it hides in the body: one inside a nested loop may pass the length.
export const f = (t: string): i32 => {
  let end: i32 = toI32(t.length);
  while (end > 0 && t.charCodeAt(end - 1) === 32) {
    end -= 1;
    for (let k: i32 = 0; k < 1; k++) {
      end += 2;
    }
  }
  return end;
};
