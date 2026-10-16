// The places that infer a type keep an enum member type, as TypeScript does:
// a ternary whose arms are both `Kind.Array`, an array literal of them, `??`
// between two `Kind.Array[]`, the same shapes passed to a generic function,
// and an unannotated `let` from a call that returns the member type. Each
// result goes back into a `Kind.Array` slot. A parenthesised constant,
// `(Kind.Array)`, is the constant, so it enters a member slot of a generic
// call as `Kind.Array` does.
enum Kind {
  Scalar,
  Array,
}

const array = (): Kind.Array => Kind.Array;

function id<T>(x: T): T {
  return x;
}

function wrap<T>(xs: T[]): T[] {
  return xs;
}

function tag<T>(x: T, k: Kind.Array): Kind.Array {
  return k;
}

class Box<T> {
  v: T;
  constructor(v: T) {
    this.v = v;
  }
  with(x: T): T {
    return x;
  }
}

export const test = (): number => {
  const a: Kind.Array = array();
  const c = a === Kind.Array;
  let t = c ? a : a;
  t = c ? (c ? a : a) : a;
  const xs = [a, t];
  xs.push(Kind.Array);
  const m: Kind.Array[] | null = c ? xs : null;
  let ys = m ?? [a];
  ys.push(t);
  const zs = wrap([a]);
  zs.push(Kind.Array);
  const u = id(c ? a : a);
  let fromCall = array();
  const p: Kind.Array = tag(3, (Kind.Array));
  const q: Kind.Array = tag(4, fromCall);
  const box = new Box<Kind.Array>(a);
  const r: Kind.Array = box.with(Kind.Array);
  const s: Kind.Array = box.with(u);
  const all = [t, xs[2], ys[0], zs[1], u, p, q, r, s];
  let same = 0;
  for (const k of all) {
    same = same + (k === Kind.Array ? 1 : 0);
  }
  return same * 10 + xs.length + ys.length;
};
