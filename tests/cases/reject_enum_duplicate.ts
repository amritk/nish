// An enum shares the one declaration namespace with functions, classes,
// interfaces, type aliases and module constants.
enum Kind {
  If = 1,
}

class Kind {
  value: i32 = 0;
}

export const test = (): i32 => 0;
