class Base {
  id: number;

  constructor(id: number) {
    this.id = id;
  }

  tag(): number {
    return this.id * 2;
  }
}

class Derived extends Base {
  extra: number;

  constructor(id: number, extra: number) {
    super(id);
    this.extra = extra;
  }
}

function sumIds(items: Base[]): number {
  let total = 0;
  for (const b of items) {
    total += b.id;
  }
  return total;
}

function lower(a: Base, b: Base): Base {
  return a.id <= b.id ? a : b;
}

function maybe(flag: boolean, d: Derived): Base | null {
  return flag ? d : null;
}

function widen(d: Derived): Base {
  return d;
}

export function main(): number {
  const d = new Derived(5, 50);
  const e = new Derived(2, 20);
  console.log(lower(d, e).id);
  const items: Base[] = [d, e];
  items.push(new Derived(3, 30));
  items[0] = new Derived(1, 10);
  console.log(sumIds(items));
  let b: Base = e;
  b = d;
  console.log(b.tag());
  const m = maybe(true, d);
  if (m !== null) {
    console.log(m.id);
  }
  console.log(widen(e).tag());
  return 0;
}
