// WP50 §5.1: an interface a generic class implements is a view, laid out one
// pointer per slot, even before anything instantiates the class, so module
// storage refuses it as it refuses one a plain class implements.
interface Pos {
  x: f32
}

class Box<T> implements Pos {
  x: f32 = 0
  v: i32 = 0
}

const S = new Array<Pos>(4)

export const main = (): void => {
  console.log(`${S.length}`)
}
