// WP50 §5.1: a record field that is itself a record is a pointer to it, so
// module storage refuses it; the inner fields go on the outer record.
interface In {
  a: i32
}

interface Out {
  p: In
  b: i32
}

const S = new Array<Out>(4)

export const main = (): void => {
  console.log(`${S.length}`)
}
