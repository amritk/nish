// WP15 §8, NL9010 on a class that `implements` an interface (#108). The
// interface's fields are the class's first fields, in order, so they stay where
// they are; the fields the class adds after them are the author's to order, and
// a badly ordered suffix pads like any other struct.
//
// `Wide` is 40 bytes as declared: `a` and the gap before `b` take 16, `c` and
// the gap before `d` another 16, and `e` rounds the struct up to 40. With the
// prefix kept and the rest widest first — `d, c, e` — the two `i32`s share one
// eight-byte slot and it is 32, with `a` and `b` exactly where `Base` puts them.
export interface Base {
  a: i32;
  b: f64;
}

export class Wide implements Base {
  a: i32 = 0;
  b: f64 = 0;
  c: i32 = 0;
  d: f64 = 0;
  e: i32 = 0;
}

// Two interfaces, and the longer one fixes the prefix: every implemented
// interface is a prefix of the class, so `Late`'s two fields are the ones that
// may not move. `Late` is declared below the class on purpose, where pass 1 has
// not collected its members when `Tagged`'s layout is reported.
export interface Tag {
  id: i32;
}

export class Tagged implements Tag, Late {
  id: i32 = 0;
  at: f64 = 0;
  flag: boolean = false;
  weight: f64 = 0;
  count: i32 = 0;
}

export interface Late {
  id: i32;
  at: f64;
}

export const test = (): number => {
  const w = new Wide();
  w.e = 3;
  const t = new Tagged();
  t.count = 4;
  const b: Base = w;
  const l: Late = t;
  return w.e + t.count + b.a + l.id + (t.flag ? 1 : 0);
};
