// --deny-panics keeps a down-counting index below the length only when the
// loop body never writes it any other way: `end = 9` may pass the length.
export const f = (t: string): i32 => {
  let end: i32 = toI32(t.length);
  while (end > 0 && t.charCodeAt(end - 1) === 32) {
    end -= 1;
    if (end === 1) end = 9;
  }
  return end;
};
