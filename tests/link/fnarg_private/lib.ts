// WP29 across modules: the shape `nish/threads` will have. Both templates are
// monomorphised here, in the module that declares them (WP18 G7), for callees
// `main.ts` keeps to itself.
export const mapInto = <T, U>(src: T[], dst: U[], f: (x: T) => U): void => {
  for (let i = 0; i < src.length; i++) {
    // The call may reach `dst`, so the guard is after it, where it reaches
    // the store.
    const y = f(src[i]);
    if (i < dst.length) {
      dst[i] = y;
    }
  }
};

export const reduce = <T>(src: T[], f: (acc: T, x: T) => T, identity: T): T => {
  let acc = identity;
  for (const x of src) {
    acc = f(acc, x);
  }
  return acc;
};
