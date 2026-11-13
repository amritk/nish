// A narrowed variable compared with a member of another enum is refused as
// any comparison across two enums is.
enum Kind {
  A,
  B,
  C,
}

enum Other {
  X,
  Y,
}

const f = (k: Kind): boolean => {
  if (k !== Kind.A) {
    return k === Other.X;
  }
  return false;
};

export const main = (): void => {
  console.log(f(Kind.B));
};
