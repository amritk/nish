// WP27 S4.1: Two structs cannot embed each other by value.
declare class A {
  b: B
}

declare class B {
  a: A
}

export const main = (): number => {
  return 0
}
