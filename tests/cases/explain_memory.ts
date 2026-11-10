// --explain-memory: which loops and functions keep the memory they allocate,
// and why. A pass that allocates only garbage is scoped and counted; a pass
// that keeps its string in a local older than the loop, grows an older array
// or stores into an object is reported, with where the memory goes back; a
// loop whose body opens with `using a = arena()` is the program's own bracket;
// a condition that allocates runs outside every pass's bracket;
// a `using` after statements that allocate nothing still brackets the pass;
// a condition and an update that both allocate get a line each, and a
// `do...while` condition is listed after the loops of its body;
// a function with a number result is scoped unless what it allocated outlives
// it; a function that answers a string is its caller's to explain.
class Box {
  label: string;
  constructor() {
    this.label = "";
  }
}

const width = (n: i32): i32 => `n=${n}`.length;

const remember = (box: Box, n: i32): i32 => {
  box.label = `n${n}`;
  return box.label.length;
};

const named = (n: i32): string => `item ${n}`;

const counted = (n: i32): i32 => {
  let total = 0;
  for (let i = 0; i < n; i++) {
    total = total + width(i);
  }
  return total;
};

const extra = (): i32 => {
  let total = 0;
  for (let i = 0; i < 3; i++) {
    const j = i + 1;
    using a = arena();
    total = total + named(j).length;
  }
  for (let t = ""; `${t}.`.length < 4; t = `${total}x`) {
    total = total + 1;
  }
  const held: string[] = [];
  let d = 0;
  do {
    for (let i = 0; i < 2; i++) {
      held.push(`h${i}`);
    }
    d = d + 1;
  } while (`${d}`.length < 2 && d < 3);
  return total + d + held.length;
};

export const main = (): void => {
  const box = new Box();
  let last = "";
  for (let i = 0; i < 3; i++) {
    last = named(i);
  }
  const seen: string[] = [];
  for (let i = 0; i < 3; i++) {
    seen.push(`s${i}`);
  }
  let kept = 0;
  for (let i = 0; i < 3; i++) {
    kept = kept + remember(box, i);
  }
  for (let i = 0; i < 3; i++) {
    using a = arena();
    kept = kept + named(i).length;
  }
  let k = 0;
  while (`${k}`.length < 2) {
    k = k + 1;
  }
  console.log(`${last} ${seen.length} ${kept} ${counted(4)} ${box.label} ${k} ${extra()}`);
};
