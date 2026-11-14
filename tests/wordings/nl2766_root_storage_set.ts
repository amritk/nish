// Root storage keeps only what the runtime can trace: a `Set` it cannot.
class Seen {
  ids: Set<i32>

  constructor() {
    this.ids = new Set<i32>()
  }
}

const seen = new Array<Seen | null>(1)

export const count = (): i32 => {
  const s = seen[0]
  return s === null ? 0 : s.ids.size
}
