enum Kind {
  If = 1,
  While = 2,
  Return = 3,
}

const weight = (k: Kind): i32 => {
  switch (k) {
    case Kind.If:
      return 10;
    case Kind.While:
      return 20;
    default:
      return 30;
  }
};

export const main = (): number => {
  const k: Kind = Kind.While;
  console.log(`weight = ${weight(k)}`);
  return 0;
};
