// --emit-arena: the loop edges of the walk. An unscoped inner loop inside a
// scoped outer pass is released by the outer pass but piles up across its own
// passes; so is a loop inside a `using a = arena()` block, until the block
// ends; a loop's condition runs every pass outside the bracket its body takes;
// a `push`, a printed number and a builtin are sites of their own; and a
// generic function is listed once per instantiation, after the module's own
// functions.
const first = <T>(xs: T[], fallback: T): T => (xs.length > 0 ? xs[0] : fallback);

const words = (n: i32): string[] => {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(`w${i}`);
  }
  return out;
};

export const main = (): void => {
  let total = 0;
  for (let round = 0; round < 3; round++) {
    let last = "";
    for (let j = 0; j < 4; j++) {
      last = `r${round}j${j}`;
    }
    total = total + last.length;
  }
  {
    using a = arena();
    let tag = "";
    for (let j = 0; j < 4; j++) {
      tag = `t${j}`;
    }
    total = total + tag.length;
  }
  let k = 0;
  while (`${k}`.length < 2) {
    k = k + 1;
  }
  const ws = words(3);
  console.log(total);
  console.log(`${first(ws, "none")} ${first([7, 8], 0)} ${ws.join(",")} ${k}`);
};
