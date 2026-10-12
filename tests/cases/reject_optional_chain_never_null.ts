// `?.` on a receiver that cannot be `null` has nothing to skip: `.` is what it
// means, so it is what to write.
class Node {
  value: i32 = 1;
  next: Node | null = null;
  take(x: i32): i32 {
    return x;
  }
}

export const f = (a: Node): i32 => a?.value ?? 0;
