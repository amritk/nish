enum Kind {
  A = 1,
  B = 2,
}

export const weight = (k: Kind): i32 => (k === Kind.A ? 1 : 2);
