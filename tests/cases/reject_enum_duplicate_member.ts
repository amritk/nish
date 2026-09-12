// Two members of one name would make `Kind.If` mean two things.
enum Kind {
  If = 1,
  If = 2,
}

export const test = (): i32 => 0;
