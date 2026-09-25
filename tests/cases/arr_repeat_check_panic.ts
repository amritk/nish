// A repeat whose check was kept still panics with the index message: each of
// these reads its index once in range and once past the end, after a `pop`, a
// call that rebinds the field, and a field store. `arr_repeat_check_panic.c`
// runs each in a child process and prints what it wrote and how it exited.
const afterPop = (xs: i32[], i: i32): i32 => {
  const a = xs[i];
  xs.pop();
  return a + xs[i];
};

class Box {
  v: i32[];

  constructor() {
    this.v = [1, 2, 3, 4];
  }

  shrink(): i32 {
    this.v = [5];
    return 0;
  }

  afterCallStore(i: i32): i32 {
    this.v[i] = this.shrink();
    return this.v[i];
  }

  afterFieldStore(i: i32): i32 {
    const a = this.v[i];
    this.v = [6];
    return a + this.v[i];
  }
}

export const popPastEnd = (): i32 => afterPop([1, 2, 3], 2);

export const callStorePastEnd = (): i32 => new Box().afterCallStore(3);

export const fieldStorePastEnd = (): i32 => new Box().afterFieldStore(3);

export const test = (): number => afterPop([1, 2, 3], 1) + new Box().afterFieldStore(0);
