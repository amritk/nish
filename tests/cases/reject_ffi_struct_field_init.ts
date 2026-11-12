// WP27 S4.1: `new` zero-fills a C struct, so a field has no initializer.
declare class Counter {
  n: i32 = 1
}

export const main = (): number => {
  return 0
}
