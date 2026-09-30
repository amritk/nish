// `meta` is an ordinary identifier. The parser reads `import.meta` as the
// meta-property Phase 0 refuses (NL1060) only where `import` is followed by
// `.meta`, so the word itself stays a name everywhere else and every use below
// compiles as it did before, to the same bytes: a module constant, a local, a
// parameter, a field and a method called `meta`, read as a member, assigned,
// called, in an interface, an object literal and a template, and at the start
// of a line after a `.`.
class Meta {
  meta: i32 = 1

  meta2(): i32 {
    return this.meta + 1
  }

  metaOf(meta: i32): i32 {
    return meta + this.meta
  }
}

class Holder {
  inner: Meta

  constructor() {
    this.inner = new Meta()
  }

  meta(): i32 {
    return this.inner.meta
  }
}

interface Tagged {
  meta: i32
  name: string
}

const meta: i32 = 3

const bump = (m: Meta): i32 => {
  m.meta = m.meta + meta
  return m.meta
}

const lineStart = (h: Holder): i32 =>
  h.inner
    .meta

export const main = (): i32 => {
  const local: Meta = new Meta()
  const h = new Holder()
  const t: Tagged = { meta: 4, name: "t" }
  const text = `${t.meta}${meta}`
  const total = bump(local) + local.meta2() + local.metaOf(meta) + h.meta() + t.meta + lineStart(h)
  // 4 + 5 + 7 + 1 + 4 + 1 = 22, and "43" is two characters.
  return total + text.length - 24
}
