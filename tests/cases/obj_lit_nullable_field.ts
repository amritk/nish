// The other contexts that expect `E | null`: a parameter, a field of an
// enclosing literal and a field store each give their literal `E`.
interface E {
  tag: i32
}

interface Link {
  head: E | null
}

class Holder {
  next: E | null = null
}

const show = (e: E | null): void => {
  if (e !== null) {
    console.log(`${e.tag}`)
  }
}

export const main = (): void => {
  show({ tag: 1 })
  const l: Link = { head: { tag: 2 } }
  show(l.head)
  const h = new Holder()
  h.next = { tag: 3 }
  show(h.next)
}
