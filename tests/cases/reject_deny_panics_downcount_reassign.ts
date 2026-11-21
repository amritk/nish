// --deny-panics drops the bound `end <= t.length` when the loop body writes
// `t`: the new string may be shorter.
export const f = (s: string): i32 => {
  let t = s;
  let end: i32 = toI32(t.length);
  while (end > 0 && t.charCodeAt(end - 1) === 32) {
    end -= 1;
    t = "x";
  }
  return end;
};
