// #740: a constructor that writes only its parameter, never a field of
// `this`, still runs the field initialisers of `this`.
class Counter {
  hits: i32 = 0;
}

class Probe {
  level: i32 = 3;
  label: i32 = 40;

  constructor(seen: Counter) {
    seen.hits = seen.hits + 1;
  }
}

export const main = (): i32 => {
  const c = new Counter();
  let total = 0;
  for (let i = 0; i < 3; i++) {
    const p = new Probe(c);
    total = total + p.level + p.label;
  }
  console.log(c.hits);
  console.log(total);
  return 0;
};
