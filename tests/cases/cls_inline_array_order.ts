// Negative: an element access evaluates its array before its index, so
// `this.slots[this.swap()]` reads the array `slots` held *before* `swap`
// rebound it -- 2, from [1, 2, 3, 4] -- and only the next read sees the new
// one. Inline slots are one storage for both arrays and would answer 20, so a
// field whose index or stored value can reach an assignment to it keeps the
// pointer layout. `swap` is reached through `step` to show the reach is the
// call graph's, not only the direct callee.
class Ring {
  slots: i32[];

  constructor() {
    this.slots = [1, 2, 3, 4];
  }

  swap(): i32 {
    this.slots = [10, 20, 30, 40];
    return 1;
  }

  step(): i32 {
    return this.swap();
  }

  readDuring(): i32 {
    return this.slots[this.step()];
  }
}

export const main = (): number => {
  const r = new Ring();
  const during = r.readDuring();
  console.log(`${during} ${r.slots[1]}`);
  return 0;
};
