// An arrow given to an async function has no capture target
// (`captureTarget`): the instance's body may run the arrow after an `await`,
// once the call that handed over the capture has returned. So `b` keeps
// today's answer, an escape, and is never an alloca of `total`'s frame.

class Box {
  v: i32;

  constructor(v: i32) {
    this.v = v;
  }
}

const tick = async (): Promise<i32> => {
  return 1;
};

const later = async (f: () => i32): Promise<i32> => {
  const t = await tick();
  return f() + t;
};

const total = async (n: i32): Promise<i32> => {
  const b = new Box(n);
  return await later(() => b.v * 2);
};

export const main = async (): Promise<void> => {
  const r = await total(20);
  console.log(`${r}`);
};
