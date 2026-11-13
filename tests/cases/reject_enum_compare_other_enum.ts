// A member of another enum never reaches enum narrowing: `===` across two
// enums is refused by the type check first, narrowed variable or not.
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
