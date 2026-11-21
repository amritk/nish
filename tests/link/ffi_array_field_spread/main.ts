// WP66 S4: a spread copies fields by value, and a fixed-length array field is
// embedded in its object, so it is refused like an embedded `declare class`.
declare class Ctx {
  a: i32
  h: Record<integer<0, 4>, u32>
}

class Plain {
  a: i32
  constructor(a: i32) {
    this.a = a
  }
}

export const main = (): i32 => {
  const c = new Ctx()
  const p: Plain = { ...c }
  return p.a
}
