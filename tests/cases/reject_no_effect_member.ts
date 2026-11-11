// Reading a field and dropping it does nothing either (NL2713).
class Box {
  n: i32;
  constructor(n: i32) {
    this.n = n;
  }
}

export const main = (): i32 => {
  const b = new Box(2);
  b.n + 1;
  return b.n;
};
