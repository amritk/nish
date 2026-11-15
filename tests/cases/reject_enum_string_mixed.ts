// Either every member of an enum has a string initializer or the enum is
// numeric: one numbering cannot be mixed with strings.
enum Mode {
  Off = "off",
  On = 1,
}

export const test = (): i32 => 0;
