// There is no inline assembly: TypeScript has no spelling for it, and no
// fact the compiler states about a call could be proved across one. `asm` is
// an unknown name like any other.
export const main = (): i32 => {
  asm("nop");
  return 0;
};
