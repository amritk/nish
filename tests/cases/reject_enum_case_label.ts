// A `switch` over an enum takes enum members as labels; the integer the member
// stands for is not a label, because that is the assignability the type exists
// to refuse.
enum Kind {
  If = 1,
  While = 2,
}

export const test = (): i32 => {
  const k: Kind = Kind.If;
  switch (k) {
    case 1:
      return 1;
    default:
      return 0;
  }
};
