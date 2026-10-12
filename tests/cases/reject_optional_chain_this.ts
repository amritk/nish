// `this` is never `null`.
class Node {
  value: i32 = 1;
  get(): i32 {
    return this?.value ?? 0;
  }
}

export const main = (): i32 => new Node().get();
