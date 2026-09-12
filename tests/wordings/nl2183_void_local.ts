// NL2183: A local of type void has no slot; the call is a statement rather than a value.
const nothing = (): void => {};

export const main = (): i32 => {
  const x: void = nothing();
  return 0;
};
