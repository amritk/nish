// Why containment is not a fixpoint of its own over the callees. `mk` takes
// only an `i32`, so what it allocates can outlive it only through what it
// returns, and on its own terms it is contained. But it returns a `Holder`
// with a fresh `X` inside, and `keep` reads that `X` back out and stores it
// through its parameter. The read `o.x` is not an allocation site, so nothing
// follows it; what refuses `keep` a scope is `allocEscapes` rising out of `mk`
// (the `Holder` constructor keeps its argument). With a scope, `k.f` would
// point into memory `main` then allocates over.
class X {
  v: i32;

  constructor(v: i32) {
    this.v = v;
  }
}

class Holder {
  x: X;

  constructor(x: X) {
    this.x = x;
  }
}

class Keeper {
  f: X | null = null;
}

const mk = (n: i32): Holder => new Holder(new X(n));

const keep = (k: Keeper, n: i32): i32 => {
  const o = mk(n);
  k.f = o.x;
  return n;
};

export const main = (): number => {
  const k = new Keeper();
  keep(k, 41);
  const junk: X[] = [];
  for (let i = 0; i < 64; i++) {
    junk.push(new X(-1));
  }
  const f = k.f;
  if (f !== null) {
    console.log(f.v);
  }
  return junk.length - 64;
};
