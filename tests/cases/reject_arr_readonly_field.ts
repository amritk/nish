// The rule is the type's, not the parameter's: a `readonly T[]` field refuses a
// store through it exactly as a parameter does, and the message names the
// annotation to change without assuming where it was written.
class Holder {
  items: readonly number[];

  constructor(items: readonly number[]) {
    this.items = items;
  }
}

export function main(): number {
  const h = new Holder([1]);
  h.items[0] = 5;
  return 0;
}
