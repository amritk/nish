// No constructor: every field has a literal initializer, stored inline at `new`.
class Defaults {
  n: number = 42;
  neg: number = -1;
  flag: boolean = true;
  name: string = "anon";
}

// Explicit constructor: initializers are stored first, then the body runs.
class Mixed {
  hits: number = 0;
  limit: number;
  label: string = "mixed";

  constructor(limit: number) {
    this.limit = limit;
    if (limit > 100) {
      this.label = "big";
    }
  }
}

export function main(): number {
  const d = new Defaults();
  console.log(d.n + d.neg);
  console.log(d.flag);
  console.log(d.name);
  const m = new Mixed(500);
  console.log(m.hits);
  console.log(m.limit);
  console.log(m.label);
  console.log(new Mixed(1).label);
  return 0;
}
