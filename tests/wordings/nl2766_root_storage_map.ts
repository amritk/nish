// Root storage keeps only what the runtime can trace: a `Map` it cannot.
class Cache {
  names: Map<string, i32>

  constructor() {
    this.names = new Map<string, i32>()
  }
}

const cache = new Array<Cache | null>(1)

export const size = (): i32 => {
  const c = cache[0]
  return c === null ? 0 : c.names.size
}
