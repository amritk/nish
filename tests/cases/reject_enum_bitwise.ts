// Bit flags stay `i32` module constants (WP23 §10 question 1): `|` on an enum
// would produce a value that is no declared member, in a language whose whole
// enum argument is that a value has one identical type.
enum Flag {
  Exported = 1,
  Const = 2,
}

export const test = (): Flag => {
  return Flag.Exported | Flag.Const;
};
