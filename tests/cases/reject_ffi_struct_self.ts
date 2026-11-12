// WP27 S4.1: A struct cannot embed itself by value.
declare class Node {
  x: i32
  next: Node
}

export const main = (): number => {
  return 0
}
