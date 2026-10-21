// The loop accept-gap (docs/LANGUAGE.md, "Accepted here, refused by tsc"):
// the loop pre-pass follows a local variable stored by a plain `x = v`
// statement, of a union of at most 29 tagged variants or an enum of at most
// 29 members, where it can read `v` before the body is checked. Each shape
// below is outside that, so after the loop the variable or path holds every
// member the body wrote anywhere in it, or its whole declared type, each
// comparison compiles here, and each is TS2367 to `tsc`. The expected errors
// keep `tsc` quiet and fail once it accepts them; once a shape is followed,
// its function is refused here and moves to a `reject_` case.
enum Kind {
  A,
  B,
  C,
}

enum Wide {
  M0,
  M1,
  M2,
  M3,
  M4,
  M5,
  M6,
  M7,
  M8,
  M9,
  M10,
  M11,
  M12,
  M13,
  M14,
  M15,
  M16,
  M17,
  M18,
  M19,
  M20,
  M21,
  M22,
  M23,
  M24,
  M25,
  M26,
  M27,
  M28,
  M29,
}

class H {
  k: Kind = Kind.A;
}

class G {
  readonly b: Kind.B = Kind.B;
}

const keep = (k: Kind): Kind => k;

const pathLoop = (h: H, n: i32): boolean => {
  h.k = Kind.A;
  let i = 0;
  while (i < n) {
    h.k = Kind.B;
    h.k = Kind.C;
    i++;
  }
  // @ts-expect-error TS2367: `h.k` is `Kind.A | Kind.C`, a path is not followed
  return h.k === Kind.B;
};

const argumentStore = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  while (i < n) {
    j = Kind.B;
    keep((j = Kind.C));
    i++;
  }
  // @ts-expect-error TS2367: `j` is `Kind.A | Kind.C`, a store inside an expression is not followed
  return j === Kind.B;
};

const initializerStore = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  while (i < n) {
    j = Kind.B;
    const t = (j = Kind.C);
    keep(t);
    i++;
  }
  // @ts-expect-error TS2367: `j` is `Kind.A | Kind.C`, a store inside an expression is not followed
  return j === Kind.B;
};

const chainStore = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let k: Kind = Kind.A;
  let i = 0;
  while (i < n) {
    j = Kind.B;
    k = j = Kind.C;
    i++;
  }
  keep(k);
  // @ts-expect-error TS2367: `j` is `Kind.A | Kind.C`, the inner store of a chain is not followed
  return j === Kind.B;
};

const elementFieldStore = (gs: G[], n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  while (i < n) {
    j = gs[0].b;
    i++;
  }
  // @ts-expect-error TS2367: `j` is `Kind.A | Kind.B`, a field read through an element is not read
  return j === Kind.C;
};

const bodyLetStore = (n: i32): boolean => {
  let j: Kind = Kind.A;
  let i = 0;
  while (i < n) {
    let t: Kind = Kind.B;
    j = t;
    t = Kind.B;
    keep(t);
    i++;
  }
  // @ts-expect-error TS2367: `j` is `Kind.A | Kind.B`, a `let` the loop declares is not read
  return j === Kind.C;
};

const wideLoop = (n: i32): boolean => {
  let w: Wide = Wide.M0;
  let i = 0;
  while (i < n) {
    w = Wide.M1;
    w = Wide.M2;
    i++;
  }
  // @ts-expect-error TS2367: `w` is `Wide.M0 | Wide.M2`, an enum of 30 members is not followed
  return w === Wide.M1;
};

export const main = (): void => {
  const h = new H();
  console.log(pathLoop(h, 2));
  console.log(argumentStore(2));
  console.log(initializerStore(2));
  console.log(chainStore(2));
  console.log(elementFieldStore([new G()], 2));
  console.log(bodyLetStore(2));
  console.log(wideLoop(2));
};
