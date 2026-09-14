class Box<T> {
  value: T;

  constructor(v: T) {
    this.value = v;
  }

  get(): T {
    return this.value;
  }
}

export const main = (): i32 => {
  const n = new Box<i32>(7);
  const s = new Box<string>("hi");
  console.log(s.get());
  return n.get();
};
