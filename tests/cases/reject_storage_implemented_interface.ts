// WP50 §5.1: an interface a class implements is a view, laid out one pointer
// per slot, so module storage refuses it.
interface Pos {
  x: f32
}

class Body implements Pos {
  x: f32 = 0
  v: i32 = 0
}

const S = new Array<Pos>(4)

export const main = (): void => {
  const b = new Body()
  console.log(`${S.length} ${b.v}`)
}
