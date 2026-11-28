// WP89 S5a: a handle class may own another, but not one that holds it back:
// `A` owns a `B` and `B` owns an `A`, so neither dispose would be the
// last to run, and a cycle of owners could never be opened at all.
declare function slot_open(): CPtr
declare function slot_close(p: CPtr): i32
class A {
  readonly b: B
  constructor(b: B) {
    this.b = b
  }
  [Symbol.dispose](): void {}
}
class B {
  readonly a: A
  constructor(a: A) {
    this.a = a
  }
  [Symbol.dispose](): void {}
}
export const main = (): i32 => 0
