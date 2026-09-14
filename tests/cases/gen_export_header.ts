// WP18 G5 + §14 q4: a declared class whose name is what an instantiation's name
// *collapses* to. `Box<i32>` is `%struct.Box$i32` in LLVM, and `-pedantic`
// refuses a `$` in a C identifier, so `--emit-header` has to spell it some other
// way — and if that way were the bare collapse, both types would be
// `struct Box_i32` and the header would not compile. `cStructName` gives the
// instantiation the reserved `nish_gen_` prefix instead, which a declared name
// can never carry, so the two cross as two C structs with two layouts.
class Box<T> {
  value: T;

  constructor(v: T) {
    this.value = v;
  }
}

class Box_i32 {
  lead: i32 = 7;
  value: i32;

  constructor(v: i32) {
    this.value = v;
  }
}

export const makeGeneric = (v: i32): Box<i32> => new Box<i32>(v);

export const makeDeclared = (v: i32): Box_i32 => new Box_i32(v);

export const genericValue = (b: Box<i32>): i32 => b.value;

export const declaredValue = (b: Box_i32): i32 => b.value;

export const test = (): number => genericValue(makeGeneric(4)) + declaredValue(makeDeclared(38));
