// NL2514 on `push`: an element of a `Kind.Array[]` holds only that member.
enum Kind {
  Scalar,
  Array,
}


export const test = (): number => {
  const a: Kind.Array[] = [];
  a.push(Kind.Scalar);
  return a.length;
};
