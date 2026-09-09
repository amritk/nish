// `readonly T[]` is a type, not a parameter modifier, so it is legal wherever an
// array type is: a class field, a return type, a `const`'s annotation. The rule
// travels with it — a store through `h.items` is refused the same way a store
// through a parameter is — which is why the diagnostic says "declare it" and
// not "declare the parameter".
class Holder {
  items: readonly number[];

  constructor(items: readonly number[]) {
    this.items = items;
  }

  total(): number {
    let sum = 0;
    for (const x of this.items) {
      sum = sum + x;
    }
    return sum;
  }
}

function labels(): readonly string[] {
  const out: string[] = ["a", "b"];
  return out;
}

export function main(): number {
  const xs: readonly number[] = [4, 5, 6];
  const h = new Holder(xs);
  console.log(h.total());
  console.log(labels().length);
  console.log(xs[2]);
  return 0;
}
