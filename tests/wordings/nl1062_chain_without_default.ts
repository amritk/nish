// NL1062: a `?.` chain that is not the left operand of `??`.
class Node {
  value: i32 = 1;
}

export const f = (a: Node | null): i32 => a?.value;
