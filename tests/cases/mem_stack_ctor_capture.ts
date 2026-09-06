class Registry {
  last: Item | null = null;
}

// The constructor stores `this` into its argument: an Item outlives the
// function that created it, so `new Item(...)` must not become an alloca.
class Item {
  value: number;

  constructor(reg: Registry, value: number) {
    this.value = value;
    reg.last = this;
  }
}

function register(reg: Registry, value: number): number {
  const item = new Item(reg, value);
  return item.value;
}

export function main(): number {
  const reg = new Registry();
  console.log(register(reg, 7));
  console.log(register(reg, 8));
  const last = reg.last;
  if (last !== null) {
    console.log(last.value);
  }
  return 0;
}
