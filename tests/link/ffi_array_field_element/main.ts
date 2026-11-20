// WP66 S4: an element of a fixed-length array field is a C scalar. A pointer
// or a nested struct element has no layout this stage lays out.
declare class Inner {
  v: i32
}

declare class Pointers {
  ptrs: Record<integer<0, 3>, CPtr>
}

declare class Nested {
  inners: Record<integer<0, 1>, Inner>
}

export const main = (): i32 => 0
