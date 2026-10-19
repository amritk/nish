// A `Secret` field (docs/LANGUAGE.md, "A `Secret` field"): `Holder` keeps a
// `Secret<u8[]>` and a `Secret<Rec>` for as long as it lives, refills one in
// place through `exposeWith`, reads both through `expose`, lends one to a
// function that takes a `Secret`, compares them with `===`, is kept in an
// array and aliased, and ends both keys in its `wipe()`.
import { Secret, expose, exposeWith, secret, wipe } from "nish:secret";

class Rec {
  a: i32;
  b: i32;
  constructor(a: i32, b: i32) {
    this.a = a;
    this.b = b;
  }
}

const sum = (k: u8[]): i32 => {
  let t: i32 = 0;
  for (let i: i32 = 0; i < toI32(k.length); i++) {
    t = t + toI32(k[i]);
  }
  return t;
};

const recSum = (r: Rec): i32 => r.a + r.b;

class Holder {
  readonly k: Secret<u8[]>;
  readonly j: Secret<Rec>;
  readonly label: string;
  constructor(seed: u8, label: string) {
    this.k = secret([seed, toU8(1), toU8(2), toU8(3)]);
    this.j = secret(new Rec(toI32(seed), 7));
    this.label = label;
  }
  refill(by: u8): void {
    exposeWith(this.k, by, (v: u8[], d: u8): i32 => {
      for (let i: i32 = 0; i < toI32(v.length); i++) {
        v[i] = v[i] + d;
      }
      return 0;
    });
  }
  tag(): i32 {
    return expose(this.k, sum) + expose(this.j, recSum);
  }
  wipe(): void {
    wipe(this.k);
    wipe(this.j);
  }
}

const borrowed = (k: Secret<u8[]>): i32 => expose(k, sum);

export const main = (): i32 => {
  const h = new Holder(5, "a");
  console.log(h.tag());
  h.refill(toU8(1));
  console.log(h.tag());
  console.log(borrowed(h.k));
  console.log(h.k === h.k);
  const g = new Holder(9, "b");
  const all: Holder[] = [h, g];
  const alias = all[1];
  console.log(borrowed(alias.k));
  console.log(h.k === alias.k);
  console.log(all[0].k === h.k);
  console.log(all.length);
  for (const x of all) {
    x.wipe();
  }
  return 0;
};
