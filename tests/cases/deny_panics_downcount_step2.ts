// --deny-panics keeps a down-counting index in range for a step of two as
// well: `end > 1` puts `end - 2` at zero or more, and `end` never rises
// past the length it started at.
const trim2 = (t: string): i32 => {
  let end: i32 = toI32(t.length);
  while (end > 1 && t.charCodeAt(end - 2) === 32) {
    end -= 2;
  }
  return end;
};
export const main = (): number => {
  console.log(trim2("ab    "));
  console.log(trim2("abc "));
  console.log(trim2(""));
  return 0;
};
