// An index variable that is assigned holds no one element: `xs[i]` is
// narrowed only while `i` keeps one value, and a store to `xs[i]` narrows it
// again.
enum Kind {
  A,
  B,
}

const moved = (xs: Kind[]): boolean => {
  let i = 0;
  if (xs[i] === Kind.A) {
    return true;
  }
  i = 1;
  return xs[i] === Kind.A;
};

const stepped = (xs: Kind[]): i32 => {
  let count = 0;
  for (let i = 0; i < xs.length; i++) {
    if (xs[i] === Kind.A) {
      count = count + 1;
    }
  }
  return count;
};

const stored = (xs: Kind[], i: i32): boolean => {
  if (xs[i] === Kind.A) {
    return true;
  }
  xs[i] = Kind.A;
  return xs[i] === Kind.A;
};

const walked = (xs: Kind[], ks: i32[]): i32 => {
  let count = 0;
  for (const k of ks) {
    if (k < 0 || k >= xs.length || xs[k] !== Kind.A) {
      continue;
    }
    count = count + (xs[k] === Kind.A ? 10 : 1);
  }
  return count;
};

export const main = (): void => {
  console.log(moved([Kind.B, Kind.A]));
  console.log(stepped([Kind.A, Kind.B, Kind.A]));
  console.log(stored([Kind.B], 0));
  console.log(walked([Kind.A, Kind.B], [0, 1, 0]));
};
