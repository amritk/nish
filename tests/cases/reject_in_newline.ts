// `in` at the start of a line is the operator when an operand follows it on
// that line: a statement opening with a name `in` could not continue so.
class Box {
  v: i32 = 1
}

export const has = (b: Box): boolean => {
  return "v"
    in b
}
